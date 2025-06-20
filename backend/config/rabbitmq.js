const amqp = require('amqplib');

let rabbitChannel;

const initRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(
      `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASSWORD || 'adminpass123'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`
    );
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertQueue('notifications', { durable: true });
    console.log('✅ Connected to RabbitMQ');
  } catch (error) {
    console.warn('⚠️ RabbitMQ failed:', error.message);
  }
};

const getRabbitChannel = () => rabbitChannel;

module.exports = { initRabbitMQ, getRabbitChannel };