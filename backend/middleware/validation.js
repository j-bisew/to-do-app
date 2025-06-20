const Joi = require('joi');

const todoSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  description: Joi.string().allow('').max(1000),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  due_date: Joi.date().optional()
});

module.exports = { todoSchema };