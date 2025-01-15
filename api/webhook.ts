import type { VercelRequest, VercelResponse } from "@vercel/node";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const bot_token = process.env.TELEGRAM_BOT_TOKEN;
const api_url = process.env.API_URL;

const allowCors = (fn) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const prepare_message = (notification) => {
  if (
    !notification.allocated_to ||
    !notification.owner ||
    !notification.reference_type ||
    !notification.description
  ) {
    return {
      msg: `<b>Thank you! <tg-emoji emoji-id="5368324170671202286">👍</tg-emoji></b>
      We will contact you shortly.`,
      documentLink: null, // Or an empty string if preferable
    };
  }

  const { allocated_to, owner, reference_type, reference_name, description } =
    notification;

  const formattedReferenceType = reference_type
    .toLowerCase()
    .replace(/ /g, "-");

  const documentLink = `${api_url}/app/${formattedReferenceType}/${reference_name}`;

  let msg = `
  <b>New Notification Arrived! <tg-emoji emoji-id="5368324170671202286">🔔</tg-emoji></b>
  
  Notification Details:
    - <strong>Allocated by</strong>: ${owner}
    - <strong>Reference Type</strong>: ${reference_type}
    - <strong>Description</strong>: ${description}
  
  
  Tibeb Design & Build ERP
  `;

  return { msg, documentLink };
};

const fetchTelegramId = async (email) => {
  try {
    console.log("fetching the id with email : ", email);
    const response = await axios.get(
      `${process.env.API_URL}/api/resource/User/${email}`,
      {
        headers: {
          Authorization: `token ${process.env.API_KEY}:${process.env.API_SECRET}`,
        },
      }
    );
    console.log({response.data.data.telegram_user_id})
    return response.data.data.telegram_user_id;
  } catch (error) {
    console.log("Error fetching Telegram ID:", error.message);
    throw new Error("Failed to fetch Telegram ID");
  }
};

const handler = async (req: VercelRequest, res: VercelResponse) => {
  const notification = req.body;
  console.log("notification data", req.body);
  if (!notification || !notification.allocated_to) {
    return res.status(400).json({ error: "Invalid notification data" });
  }

  try {
    const telegramId = await fetchTelegramId(notification.allocated_to);

    if (!telegramId) {
      return res.status(404).json({
        error: `Telegram ID not found for ${notification.allocated_to}`,
      });
    }

    const { msg, documentLink } = prepare_message(notification);
    const bot = new TelegramBot(bot_token);

    // Send the message
    await bot.sendMessage(telegramId, msg, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "View Attached Document",
              url: documentLink,
            },
          ],
        ],
      },
    });

    res
      .status(200)
      .json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("Error in handler:", error.message);
    res.status(500).json({ error: "Failed to process the request" });
  }
};

module.exports = allowCors(handler);
