export default async function handler(req, res) {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'softcake_baker_secret_token_2026';
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const APP_URL = 'https://softcake-baker.vercel.app';

  // ─── Webhook Verification (GET) ───
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
      }
      return res.status(403).send('Forbidden');
    }
    return res.status(400).send('Bad Request');
  }

  // ─── Incoming Events (POST) ───
  if (req.method === 'POST') {
    const body = req.body;

    if (body.object === 'page') {
      res.status(200).send('EVENT_RECEIVED');

      for (const entry of body.entry) {
        if (!entry.messaging) {
          console.log('Skipping non-messaging entry');
          continue;
        }

        for (const event of entry.messaging) {
          if (!event.sender || !event.sender.id) continue;
          const psid = event.sender.id;

          try {
            if (event.postback) {
              await handlePostback(psid, event.postback, PAGE_ACCESS_TOKEN, APP_URL);
            } else if (event.message && !event.message.is_echo) {
              await handleMessage(psid, event.message, PAGE_ACCESS_TOKEN, APP_URL);
            }
          } catch (err) {
            console.error('Error handling event:', err);
          }
        }
      }
      return;
    }
    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}

// ═══════════════════════════════════════════════════════════════
//  CORE HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleMessage(psid, msg, token, appUrl) {
  const text = msg.text ? msg.text.toLowerCase() : '';

  if (
    text.includes('interested') ||
    text.includes('soft cake') ||
    text.includes('สนใจ') ||
    text.includes('เค้ก') ||
    text.includes('cake')
  ) {
    await triggerStep1(psid, token, appUrl);
  } else if (text.includes('detail') || text.includes('flavour') || text.includes('flavor') || text.includes('รายละเอียด')) {
    await triggerStep2(psid, token);
  } else if (text.includes('order') || text.includes('สั่ง') || text.includes('buy')) {
    await triggerStep3(psid, token, appUrl);
  } else if (text.includes('contact') || text.includes('admin') || text.includes('ติดต่อ')) {
    await sendText(psid, 'Please wait, our admin will reply to you shortly 🙏', token);
  } else {
    // Default welcome
    await sendWelcome(psid, token);
  }
}

async function handlePostback(psid, postback, token, appUrl) {
  const payload = postback.payload;
  console.log('Postback:', payload);

  switch (payload) {
    case 'MAIN_MENU':
    case 'GET_STARTED':
      await sendWelcome(psid, token);
      break;

    case 'INTERESTED_SOFTCAKE':
      await triggerStep1(psid, token, appUrl);
      break;

    case 'SOFTCAKE_DETAILS':
      await triggerStep2(psid, token);
      break;

    case 'ORDER_MENU':
      await triggerStep3(psid, token, appUrl);
      break;

    case 'CONTACT_ADMIN':
      await sendText(psid, 'Please wait, our admin will reply to you shortly 🙏', token);
      break;

    case 'DELIVERY_PICKUP':
    case 'DELIVERY_KL':
    case 'DELIVERY_OTHER':
      await triggerWhatsAppFlow(psid, payload, token);
      break;

    default:
      console.log('Unknown postback:', payload);
      await sendText(psid, 'Thank you for your interest! Please contact our admin for more details 🙏', token);
  }
}

// ═══════════════════════════════════════════════════════════════
//  WELCOME
// ═══════════════════════════════════════════════════════════════

async function sendWelcome(psid, token) {
  const welcome = {
    "text": "Assalamualaikum & Hi! 👋\nWelcome to Apple Bake 🍎🍰\n\nWe craft premium handmade Mini Soft Cakes\nwith 24 unique flavours!\n\n🇲🇾 Delivery to ALL states across Malaysia\n📦 Pre-order welcome!\n\n🔥 Tap the button below to see our promo!",
    "quick_replies": [
      {
        "content_type": "text",
        "title": "🍰 I'm Interested!",
        "payload": "INTERESTED_SOFTCAKE"
      },
      {
        "content_type": "text",
        "title": "📞 Contact Admin",
        "payload": "CONTACT_ADMIN"
      }
    ]
  };
  await callSendAPI(psid, welcome, token);
}

// ═══════════════════════════════════════════════════════════════
//  STEP 1 — Promotion + Hero Image
// ═══════════════════════════════════════════════════════════════

async function triggerStep1(psid, token, appUrl) {
  // Promo text
  await sendText(psid,
    '🔥 HOT PROMO — First 50 Customers Only!\n\n' +
    'Mini Soft Cake only RM 1.90 / piece! 🍰\n\n' +
    'Available for delivery to ALL states across Malaysia 🇲🇾\n' +
    '⚠️ This promo is for the FIRST 50 customers ONLY!',
    token
  );

  // Hero card with "View Details" button
  const heroCard = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [
          {
            "title": "🍰 Apple Bake — Mini Soft Cake",
            "image_url": `${appUrl}/images/hero.png`,
            "subtitle": "Premium handmade soft cakes — 24 unique flavours! Tap below for details.",
            "buttons": [
              {
                "type": "postback",
                "title": "📄 View Details",
                "payload": "SOFTCAKE_DETAILS"
              }
            ]
          }
        ]
      }
    }
  };
  await callSendAPI(psid, heroCard, token);
}

// ═══════════════════════════════════════════════════════════════
//  STEP 2 — 24 Flavours + Conditions + Storage
// ═══════════════════════════════════════════════════════════════

async function triggerStep2(psid, token) {
  // 24 Flavours
  await sendText(psid,
    '🍰 Our 24 Soft Cake Flavours:\n\n' +
    '01 - Blueberry Marshmallow\n' +
    '02 - Strawberry Marshmallow\n' +
    '03 - Strawberry Orange\n' +
    '04 - Triple Bake\n' +
    '05 - Chocolate\n' +
    '06 - Orange\n' +
    '07 - Strawberry & Cream\n' +
    '08 - Green & Bake\n' +
    '09 - Blue & Cream\n' +
    '10 - Thai Tea with Jelly\n' +
    '11 - Thai Tea\n' +
    '12 - Green & Jelly\n' +
    '13 - Cream Bake\n' +
    '14 - Cream with Nuts\n' +
    '15 - Cream with Jelly\n' +
    '16 - Orange with Cream\n' +
    '17 - Cream with Strawberry\n' +
    '18 - Strawberry\n' +
    '19 - Choco & Cream\n' +
    '20 - Orange Fruity\n' +
    '21 - Rainbow\n' +
    '22 - Choco Banana\n' +
    '23 - Jelly Cream with Caramel\n' +
    '24 - Mix Bake',
    token
  );

  // Ordering conditions
  await sendText(psid,
    '📍 Ordering Conditions\n\n' +
    '🕗 Order Hours:\n' +
    'Daily from 08:00 – 19:00\n\n' +
    '⏰ Orders confirmed before 20:00\n' +
    '🍞 Production starts that night for maximum freshness!\n\n' +
    '🚚 Delivery:\n' +
    '🏙 KL / Selangor — 1-2 days\n' +
    '  • 1-5 boxes → RM 35 shipping\n' +
    '  • 5+ boxes → FREE shipping\n\n' +
    '🌆 Other States (Negeri Lain) — 1-3 days\n' +
    '  • 1-19 boxes → Based on actual shipping cost\n' +
    '  • 20+ boxes → FREE shipping\n\n' +
    '⏰ Order & payment cutoff: 22:00 daily',
    token
  );

  // Storage instructions
  await sendText(psid,
    '❄️ Storage Instructions — Mini Soft Cake 🍰\n\n' +
    'Shelf life: 5–7 days\n' +
    '(Keep refrigerated at 1–5°C from the day received)\n\n' +
    '‼️ Soft cakes MUST be refrigerated!\n' +
    'If not kept cold & exposed to heat → may spoil within 1 day\n\n' +
    '📋 Tips:\n' +
    '1️⃣ Refrigerate immediately upon receiving\n' +
    '2️⃣ If selling without a display fridge, use a styrofoam box with cooling gel or dry ice\n' +
    '3️⃣ After removing from fridge (below 5°C):\n' +
    '   ⏰ Best consumed within 24 hours\n' +
    '   😊 If re-refrigerated → can last up to 2 more days\n\n' +
    '‼️ Without refrigeration → may spoil within 1–2 days',
    token
  );

  // Order button
  const orderBtn = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "Ready to order? Tap below to proceed! 👇",
        "buttons": [
          {
            "type": "postback",
            "title": "🛒 Order Now",
            "payload": "ORDER_MENU"
          }
        ]
      }
    }
  };
  await callSendAPI(psid, orderBtn, token);
}

// ═══════════════════════════════════════════════════════════════
//  STEP 3 — Delivery Options Carousel
// ═══════════════════════════════════════════════════════════════

async function triggerStep3(psid, token, appUrl) {
  await sendText(psid,
    '❤️ Pricing:\n' +
    '• Mini Soft Cake — 1 box (42 pcs) = RM 2.90/pc\n' +
    '• Order 10+ boxes → Special price RM 1.90/pc! 🎉\n\n' +
    '🚚 Please select your delivery option below 👇',
    token
  );

  const carousel = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "image_aspect_ratio": "square",
        "elements": [
          {
            "title": "1️⃣ Self Pick-up at Factory",
            "image_url": `${appUrl}/images/classic.png`,
            "subtitle": "COD at shop — convenient & easy!",
            "buttons": [
              { "type": "postback", "title": "Select Pick-up", "payload": "DELIVERY_PICKUP" }
            ]
          },
          {
            "title": "2️⃣ Delivery (KL / Selangor)",
            "image_url": `${appUrl}/images/hero.png`,
            "subtitle": "1-2 days | 5+ boxes = FREE shipping",
            "buttons": [
              { "type": "postback", "title": "Select KL Delivery", "payload": "DELIVERY_KL" }
            ]
          },
          {
            "title": "3️⃣ Delivery (Negeri Lain)",
            "image_url": `${appUrl}/images/pandan.png`,
            "subtitle": "1-3 days | 20+ boxes = FREE shipping",
            "buttons": [
              { "type": "postback", "title": "Select Other States", "payload": "DELIVERY_OTHER" }
            ]
          }
        ]
      }
    }
  };
  await callSendAPI(psid, carousel, token);
}

// ═══════════════════════════════════════════════════════════════
//  STEP 4 — WhatsApp Order Template + Redirect
// ═══════════════════════════════════════════════════════════════

const ORDER_ITEMS =
  '1.Orange =\n' +
  '2.Choco Chip =\n' +
  '3.Foi Thong =\n' +
  '4.Choco Banana =\n' +
  '5.White Choco Chip & Cream =\n' +
  '6.Chocolate Orange =\n' +
  '7.Choco Chip & Cream =\n' +
  '8.Blueberry & Cream =\n' +
  '9.Oreo Chip & Cream =\n' +
  '10.Strawberry & Cream =\n' +
  '11.Almond Caramel =\n' +
  '12.Coffee Choco Chip =\n' +
  '13.Double Oreo =\n' +
  '14.Rainbow Marshmallow =\n' +
  '15.Chocolate =\n' +
  '16.Thai Tea Boba Brown =\n' +
  '17.Strawberry White Choco =\n' +
  '18.Blueberry White Choco Chip =\n' +
  '19.Lod Chong =\n' +
  '20.Hokkaido Milk =\n\n' +
  'Brownie =\n' +
  'Salted Egg Lava Pia =\n' +
  'Éclair (Round) Hokkaido Milk =\n' +
  'Éclair (Round) Chocolate =\n\n' +
  'Butter Bread Hokkaido Milk =\n' +
  'Butter Bread Chocolate =';

async function triggerWhatsAppFlow(psid, payloadType, token) {
  const whatsappNumber = '60111222333'; // ← CHANGE to real WhatsApp number

  let header = '';
  let deliveryInfo = '';

  if (payloadType === 'DELIVERY_PICKUP') {
    header = '** COD at Shop **';
    deliveryInfo =
      '📍 Self Pick-up at Factory\n' +
      '• Mini Soft Cake RM 2.90/pc | 1 box = 42 pcs\n' +
      '• Order 10+ boxes → RM 1.90/pc!';
  } else if (payloadType === 'DELIVERY_KL') {
    header = '** Delivery to Customer Address (KL / Selangor) **';
    deliveryInfo =
      '🚚 Delivery (KL / Selangor)\n' +
      '• 1-2 days delivery\n' +
      '• 1-5 boxes → RM 35 shipping\n' +
      '• 5+ boxes → FREE shipping';
  } else {
    header = '** Delivery to Customer Address (Negeri Lain) **';
    deliveryInfo =
      '🚚 Delivery (Negeri Lain)\n' +
      '• 1-3 days delivery\n' +
      '• 1-19 boxes → Shipping based on actual cost\n' +
      '• 20+ boxes → FREE shipping';
  }

  // Delivery info
  await sendText(psid, deliveryInfo, token);

  // Order template
  await sendText(psid,
    '📋 How to Order:\n\n' +
    'Step 1️⃣ — Copy the message below 👇\n' +
    'then send it to our WhatsApp Admin\n\n' +
    'Order mini soft cake\n' +
    header + '\n\n' +
    ORDER_ITEMS + '\n\n' +
    '─────────────────────\n\n' +
    'Step 2️⃣ — Fill in the quantity after each item\n\n' +
    'Step 3️⃣ — Send the completed list to Admin\n' +
    'for order confirmation & payment\n\n' +
    'Step 4️⃣ — Order & payment cutoff: 22:00 daily',
    token
  );

  // WhatsApp button
  const waButton = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "✅ Copy the order form above, then tap below to open WhatsApp! 🟢",
        "buttons": [
          {
            "type": "web_url",
            "url": `https://wa.me/${whatsappNumber}`,
            "title": "💬 Chat on WhatsApp"
          }
        ]
      }
    }
  };
  await callSendAPI(psid, waButton, token);
}

// ═══════════════════════════════════════════════════════════════
//  SEND API
// ═══════════════════════════════════════════════════════════════

async function sendText(psid, text, token) {
  await callSendAPI(psid, { "text": text }, token);
}

async function callSendAPI(psid, message, token) {
  if (!token) {
    console.error('Missing PAGE_ACCESS_TOKEN');
    return;
  }

  const body = {
    "recipient": { "id": psid },
    "message": message
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    const data = await response.json();
    if (data.error) {
      console.error('Send API Error:', JSON.stringify(data.error));
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}
