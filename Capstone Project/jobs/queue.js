const { Queue, Worker } = require("bullmq");
const cron = require("node-cron");

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
};

const orderQueue = new Queue("order-emails", { connection });

function startWorker() {
  const worker = new Worker(
    "order-emails",
    async (job) => {
      if (job.name === "order-confirmation") {
        console.log(`[worker] Order confirmation email sent for order ${job.data.orderId}`);
      }
      if (job.name === "order-failed") {
        console.log(`[worker] Payment-failed email sent for order ${job.data.orderId}`);
      }
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job.id} failed: ${err.message}`);
  });

  return worker;
}

// A scheduled job: release stock held by orders that have sat "pending"
// (created but never paid, e.g. the user abandoned checkout) for too long.
function startExpiredOrderSweep(Order, Product) {
  return cron.schedule("*/5 * * * *", async () => {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    const expired = await Order.find({ status: "pending", createdAt: { $lt: cutoff } });

    for (const order of expired) {
      const session = await Order.startSession();
      session.startTransaction();
      try {
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } },
            { session }
          );
        }
        order.status = "cancelled";
        await order.save({ session });
        await session.commitTransaction();
        console.log(`[cron] Released stock for abandoned order ${order._id}`);
      } catch (err) {
        await session.abortTransaction();
        console.error(`[cron] Failed to release stock for order ${order._id}: ${err.message}`);
      } finally {
        session.endSession();
      }
    }
  });
}

module.exports = { orderQueue, startWorker, startExpiredOrderSweep };
