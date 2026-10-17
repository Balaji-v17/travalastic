/**
 * Service for calculating equal-split expense sharing, balances, and settlements.
 * All monetary calculations are performed strictly in integer paise (Math.round(amountINR * 100)).
 */

/**
 * Splits an amount in integer paise equally among n participants.
 * The remainder paise are distributed 1 each to the first `remainder` participants in order.
 *
 * @param {number} totalPaise
 * @param {string[]} splitAmong
 * @returns {Record<string, number>} mapping of participantId -> share in paise
 */
export function calculateShares(totalPaise, splitAmong) {
  if (!Array.isArray(splitAmong) || splitAmong.length === 0) {
    return {};
  }
  const n = splitAmong.length;
  const base = Math.floor(totalPaise / n);
  const remainder = totalPaise % n;
  const shares = {};

  splitAmong.forEach((personId, idx) => {
    shares[personId] = base + (idx < remainder ? 1 : 0);
  });

  return shares;
}

/**
 * Computes greedy settlements among non-zero balances.
 * Repeatedly pairs the largest debtor with the largest creditor.
 *
 * @param {Record<string, number>} balances participantId -> net balance in paise
 * @returns {Array<{ from: string, to: string, amountPaise: number }>}
 */
export function calculateSettlements(balances) {
  const debtors = [];
  const creditors = [];

  for (const [id, balance] of Object.entries(balances)) {
    if (balance < 0) {
      debtors.push({ id, amountPaise: -balance });
    } else if (balance > 0) {
      creditors.push({ id, amountPaise: balance });
    }
  }

  const settlements = [];

  while (debtors.length > 0 && creditors.length > 0) {
    // Sort descending so the largest debtor and creditor are first
    debtors.sort((a, b) => b.amountPaise - a.amountPaise);
    creditors.sort((a, b) => b.amountPaise - a.amountPaise);

    const debtor = debtors[0];
    const creditor = creditors[0];

    const transfer = Math.min(debtor.amountPaise, creditor.amountPaise);
    if (transfer > 0) {
      settlements.push({
        from: debtor.id,
        to: creditor.id,
        amountPaise: transfer,
      });
    }

    debtor.amountPaise -= transfer;
    creditor.amountPaise -= transfer;

    if (debtor.amountPaise === 0) {
      debtors.shift();
    }
    if (creditor.amountPaise === 0) {
      creditors.shift();
    }
  }

  return settlements;
}

/**
 * Calculates trip expense breakdown:
 * - groupTotalPaise: total trip expenses in integer paise
 * - yourSharePaise: sum of personal expenses paid by "me" + computed shares of shared expenses where "me" is in splitAmong
 * - balances: net balance in paise for every trip participant on SHARED expenses only (payer gets credit, split participants get debited)
 * - settlements: minimal transfers to settle all shared balances
 *
 * @param {Array<object>} expenses
 * @param {Array<object>} travelers
 * @returns {{
 *   totals: { groupTotalPaise: number, yourSharePaise: number },
 *   balances: Record<string, number>,
 *   settlements: Array<{ from: string, to: string, amountPaise: number }>
 * }}
 */
export function calculateExpenseSplits(expenses = [], travelers = []) {
  const participantIds = ['me', ...travelers.map((t) => (t._id ? t._id.toString() : String(t)))];

  const balances = {};
  for (const id of participantIds) {
    balances[id] = 0;
  }

  let groupTotalPaise = 0;
  let yourSharePaise = 0;

  for (const exp of expenses) {
    const amountPaise = Math.round((Number(exp.amountINR) || 0) * 100);
    groupTotalPaise += amountPaise;

    const payer = (exp.paidBy && String(exp.paidBy).trim()) || 'me';
    const splitAmong = Array.isArray(exp.splitAmong) ? exp.splitAmong : [];

    if (splitAmong.length === 0) {
      // Personal expense:
      // A personal expense counts its full amount if paid by "me", 0 if paid by someone else.
      if (payer === 'me') {
        yourSharePaise += amountPaise;
      }
      // Personal expenses NEVER enter balances or settlements.
    } else {
      // Shared expense:
      // Amount paid by payer on shared expense
      balances[payer] = (balances[payer] || 0) + amountPaise;

      const shares = calculateShares(amountPaise, splitAmong);
      for (const [personId, share] of Object.entries(shares)) {
        balances[personId] = (balances[personId] || 0) - share;
        if (personId === 'me') {
          yourSharePaise += share;
        }
      }
    }
  }

  const settlements = calculateSettlements(balances);

  return {
    totals: {
      groupTotalPaise,
      yourSharePaise,
    },
    balances,
    settlements,
  };
}

