import express from 'express';
import mongoose from 'mongoose';
import authenticate from '../middleware/authenticate.js';
import Expense from '../models/Expense.js';

const router = express.Router();

/**
 * DELETE /expenses/:expenseId
 * Protected by JWT authenticate middleware.
 * Verifies expense exists and belongs to req.userId.
 * Removes the expense and returns confirmation.
 */
router.delete('/:expenseId', authenticate, async (req, res, next) => {
  try {
    const { expenseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const expense = await Expense.findById(expenseId);

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (expense.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized to delete this expense' });
    }

    await Expense.findByIdAndDelete(expenseId);

    return res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
      deletedId: expenseId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
