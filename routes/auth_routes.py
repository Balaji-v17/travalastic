import re
from functools import wraps
from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from sqlalchemy import func
from models import db, User

auth_bp = Blueprint("auth", __name__)

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            if request.is_json or request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized. Please log in."}), 401
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "user_id" not in session:
                if request.is_json or request.path.startswith("/api/"):
                    return jsonify({"error": "Unauthorized. Please log in."}), 401
                return redirect(url_for("login"))
            
            user_role = session.get("role")
            if user_role not in allowed_roles:
                if request.is_json or request.path.startswith("/api/"):
                    return jsonify({"error": f"Forbidden. Role '{user_role}' does not have access."}), 403
                
                if user_role == "EMPLOYEE":
                    return redirect(url_for("employee_dashboard"))
                elif user_role == "MANAGER":
                    return redirect(url_for("approver_dashboard"))
                elif user_role == "FINANCE_ADMIN":
                    return redirect(url_for("finance_dashboard"))
                return redirect(url_for("login"))
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_role_redirect_url(role: str) -> str:
    if role == "EMPLOYEE":
        return "/employee"
    elif role == "MANAGER":
        return "/approver"
    elif role == "FINANCE_ADMIN":
        return "/finance"
    return "/login"

# -----------------------------------------------------------------------------
# Registration Routes
# -----------------------------------------------------------------------------

@auth_bp.route("/register", methods=["GET"])
def register_page():
    if "user_id" in session:
        return redirect(get_role_redirect_url(session.get("role")))
    return render_template("register.html")

@auth_bp.route("/api/auth/register", methods=["POST"])
def register_api():
    data = request.get_json(silent=True) or request.form.to_dict()
    name = (data.get("name") or "").strip()
    email_raw = (data.get("email") or "").strip()
    department = (data.get("department") or "").strip()
    password = (data.get("password") or "").strip()
    confirm_password = (data.get("confirm_password") or "").strip()

    # 1. Required fields check
    if not name or not email_raw or not department or not password or not confirm_password:
        return jsonify({"error": "All fields are required (name, email, department, password, confirm_password)."}), 400

    # 2. Length limits
    if len(name) > 100:
        return jsonify({"error": "Name cannot exceed 100 characters."}), 400
    if len(department) > 100:
        return jsonify({"error": "Department cannot exceed 100 characters."}), 400
    if len(email_raw) > 120:
        return jsonify({"error": "Email cannot exceed 120 characters."}), 400
    if len(password) > 128:
        return jsonify({"error": "Password cannot exceed 128 characters."}), 400

    # 3. Email format validation
    email = email_raw.lower()
    if not EMAIL_REGEX.match(email):
        return jsonify({"error": "Please provide a valid email address."}), 400

    # 4. Password validation: minimum 8 characters & matching confirmation
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long."}), 400

    if password != confirm_password:
        return jsonify({"error": "Passwords do not match."}), 400

    # 5. Duplicate email check (case-insensitive)
    existing_user = User.query.filter(func.lower(User.email) == email).first()
    if existing_user:
        return jsonify({"error": "An account with this email address is already registered."}), 409

    # 6. Role enforcement: MUST ALWAYS be "EMPLOYEE" (ignore any client-provided role)
    new_user = User(
        name=name,
        email=email,
        department=department,
        role="EMPLOYEE"
    )
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        "message": "Registration successful! You may now sign in.",
        "user": new_user.to_dict(),
        "redirect_url": "/login?registered=1"
    }), 201

# -----------------------------------------------------------------------------
# Login / Logout Routes
# -----------------------------------------------------------------------------

@auth_bp.route("/api/auth/login", methods=["POST"])
def login_api():
    data = request.get_json(silent=True) or request.form.to_dict()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    user = User.query.filter(func.lower(User.email) == email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password."}), 401

    session.permanent = True
    session["user_id"] = user.id
    session["name"] = user.name
    session["email"] = user.email
    session["role"] = user.role
    session["department"] = user.department

    redirect_url = get_role_redirect_url(user.role)

    return jsonify({
        "message": "Login successful.",
        "user": user.to_dict(),
        "redirect_url": redirect_url
    }), 200

@auth_bp.route("/api/auth/logout", methods=["POST", "GET"])
def logout_api():
    session.clear()
    if request.is_json or request.path.startswith("/api/"):
        return jsonify({"message": "Logged out successfully."}), 200
    return redirect(url_for("login"))

@auth_bp.route("/api/auth/me", methods=["GET"])
def get_current_user():
    if "user_id" not in session:
        return jsonify({"authenticated": False, "user": None}), 200

    user = User.query.get(session["user_id"])
    if not user:
        session.clear()
        return jsonify({"authenticated": False, "user": None}), 200

    return jsonify({
        "authenticated": True,
        "user": user.to_dict()
    }), 200

@auth_bp.route("/dev/login-as/<role_key>", methods=["GET"])
def dev_quick_login(role_key):
    role_map = {
        "employee": "employee@example.com",
        "manager": "manager@example.com",
        "finance": "finance@example.com"
    }
    email = role_map.get(role_key.lower())
    if not email:
        return redirect(url_for("login"))

    user = User.query.filter_by(email=email).first()
    if not user:
        return redirect(url_for("login"))

    session.permanent = True
    session["user_id"] = user.id
    session["name"] = user.name
    session["email"] = user.email
    session["role"] = user.role
    session["department"] = user.department

    next_url = request.args.get("next")
    if next_url:
        return redirect(next_url)

    return redirect(get_role_redirect_url(user.role))
