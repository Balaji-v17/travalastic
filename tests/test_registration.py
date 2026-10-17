import unittest
from app import create_app
from models import db, User

class TestEmployeeRegistration(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.ctx = self.app.app_context()
        self.ctx.push()
        self.client = self.app.test_client()

        # Clean up any leftover test users before tests run
        self._cleanup_test_users()

    def tearDown(self):
        self._cleanup_test_users()
        self.ctx.pop()

    def _cleanup_test_users(self):
        test_users = User.query.filter(User.email.like("%@testreg.com")).all()
        for u in test_users:
            db.session.delete(u)
        db.session.commit()

    def test_get_register_page_unauthenticated(self):
        """GET /register renders registration page for guest users."""
        response = self.client.get("/register")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Create Employee Account", response.data)
        self.assertIn(b"Work Email", response.data)

    def test_get_register_page_authenticated_redirects(self):
        """GET /register redirects logged in users to their dashboard."""
        seed_employee = User.query.filter_by(email="employee@example.com").first()
        with self.client.session_transaction() as sess:
            sess["user_id"] = seed_employee.id
            sess["name"] = seed_employee.name
            sess["email"] = seed_employee.email
            sess["role"] = seed_employee.role
            sess["department"] = seed_employee.department

        response = self.client.get("/register")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/employee")

    def test_successful_registration(self):
        """User registers with valid data, is saved as EMPLOYEE with lowercase email, and gets redirect_url."""
        payload = {
            "name": "Jane Developer",
            "email": "Jane.Dev@TestReg.com",
            "department": "Engineering",
            "password": "strongPassword123",
            "confirm_password": "strongPassword123"
        }
        response = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(response.status_code, 201)

        data = response.get_json()
        self.assertIn("Registration successful", data.get("message", ""))
        self.assertEqual(data.get("redirect_url"), "/login?registered=1")
        self.assertEqual(data["user"]["role"], "EMPLOYEE")
        self.assertEqual(data["user"]["email"], "jane.dev@testreg.com")

        # Verify database record
        user = User.query.filter_by(email="jane.dev@testreg.com").first()
        self.assertIsNotNone(user)
        self.assertEqual(user.name, "Jane Developer")
        self.assertEqual(user.role, "EMPLOYEE")
        self.assertEqual(user.department, "Engineering")
        self.assertTrue(user.check_password("strongPassword123"))

    def test_duplicate_email(self):
        """Attempting to register with an existing email (case-insensitive) returns 409."""
        # 1. Register first user
        initial_payload = {
            "name": "First User",
            "email": "duplicate@testreg.com",
            "department": "Operations",
            "password": "validPassword123",
            "confirm_password": "validPassword123"
        }
        res1 = self.client.post("/api/auth/register", json=initial_payload)
        self.assertEqual(res1.status_code, 201)

        # 2. Attempt duplicate registration with uppercase email
        dup_payload = {
            "name": "Duplicate User",
            "email": "DUPLICATE@TESTREG.COM",
            "department": "Marketing",
            "password": "anotherPassword123",
            "confirm_password": "anotherPassword123"
        }
        res2 = self.client.post("/api/auth/register", json=dup_payload)
        self.assertEqual(res2.status_code, 409)

        data = res2.get_json()
        self.assertIn("already registered", data.get("error", "").lower())

    def test_short_password(self):
        """Passwords shorter than 8 characters are rejected with 400."""
        payload = {
            "name": "Short Password User",
            "email": "shortpass@testreg.com",
            "department": "Sales",
            "password": "pass7",
            "confirm_password": "pass7"
        }
        response = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(response.status_code, 400)

        data = response.get_json()
        self.assertIn("at least 8 characters", data.get("error", ""))

    def test_mismatched_passwords(self):
        """Mismatched password and confirm_password are rejected with 400."""
        payload = {
            "name": "Mismatch User",
            "email": "mismatch@testreg.com",
            "department": "Finance",
            "password": "securePassword123",
            "confirm_password": "differentPassword123"
        }
        response = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(response.status_code, 400)

        data = response.get_json()
        self.assertIn("do not match", data.get("error", "").lower())

    def test_role_cannot_be_elevated(self):
        """Sending role=MANAGER or role=FINANCE_ADMIN in payload is ignored; role is strictly EMPLOYEE."""
        payload = {
            "name": "Privilege Escalator",
            "email": "attacker@testreg.com",
            "department": "Management",
            "password": "exploitPassword123",
            "confirm_password": "exploitPassword123",
            "role": "MANAGER"  # Attempt to escalate to MANAGER
        }
        response = self.client.post("/api/auth/register", json=payload)
        self.assertEqual(response.status_code, 201)

        data = response.get_json()
        self.assertEqual(data["user"]["role"], "EMPLOYEE")

        # Verify in database that stored role is strictly EMPLOYEE
        user = User.query.filter_by(email="attacker@testreg.com").first()
        self.assertIsNotNone(user)
        self.assertEqual(user.role, "EMPLOYEE")
        self.assertNotEqual(user.role, "MANAGER")

if __name__ == "__main__":
    unittest.main()

