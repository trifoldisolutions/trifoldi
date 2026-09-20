const mongoose = require('mongoose');

const STATUSES = ['todo', 'in-progress', 'done'];

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    status: { type: String, enum: STATUSES, default: 'todo' },
  },
  { timestamps: true }
);

const Task = mongoose.model('Task', taskSchema);
Task.STATUSES = STATUSES;

module.exports = Task;
