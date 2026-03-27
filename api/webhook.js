export default async function handler(req, res) {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'softcake_baker_secret_token_2026';
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const LANDING_PAGE_URL = 'https://softcake-baker.vercel.app'; // Replace with actual once known

  // Handle Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
      } else {
        return res.status(403).send('Forbidden');
      }
    }
    return res.status(400).send('Bad Request');
  }

  // Handle Incoming Messages (POST)
  if (req.method === 'POST') {
    const body = req.body;

    if (body.object === 'page') {
      // Respond immediately to Meta to acknowledge receipt
      res.status(200).send('EVENT_RECEIVED');

      // Iterate over each entry
      for (const entry of body.entry) {
        // Iterate over each messaging event
        for (const webhook_event of entry.messaging) {
          const sender_psid = webhook_event.sender.id;
          
          if (webhook_event.message) {
            await handleMessage(sender_psid, webhook_event.message, PAGE_ACCESS_TOKEN, LANDING_PAGE_URL);
          } else if (webhook_event.postback) {
            await handlePostback(sender_psid, webhook_event.postback, PAGE_ACCESS_TOKEN, LANDING_PAGE_URL);
          }
        }
      }
      return;
    }
    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}

// -------------------------------------------------------------
// Core Messaging Functions
// -------------------------------------------------------------

async function handleMessage(sender_psid, received_message, access_token, appUrl) {
  let response;

  if (received_message.text) {
    const text = received_message.text.toLowerCase();

    if (text.includes('สนใจเค้ก') || text.includes('เค้ก') || text.includes('cake') || text.includes('menu')) {
      response = getProductCarousel(appUrl);
    } else if (text.includes('partner') || text.includes('พาร์ทเนอร์')) {
      response = getPartnershipResponse(appUrl);
    } else {
      // Default fallback
      response = {
        "text": "Hello from Softcake Baker! 🍰\nWe deliver premium soft-crust cakes across KL & Selangor.\n\nHow can we help you today?",
        "quick_replies": [
          {
            "content_type": "text",
            "title": "🧁 View Cakes Menu",
            "payload": "VIEW_CAKES"
          },
          {
            "content_type": "text",
            "title": "🤝 Partnership",
            "payload": "VIEW_PARTNER"
          }
        ]
      };
    }
  }

  await callSendAPI(sender_psid, response, access_token);
}

async function handlePostback(sender_psid, received_postback, access_token, appUrl) {
  let response;
  const payload = received_postback.payload;

  if (payload === 'Order Soft-Crust Cakes' || payload === 'VIEW_CAKES') {
    response = getProductCarousel(appUrl);
  } else if (payload === 'Partnership in KL/Selangor' || payload === 'VIEW_PARTNER') {
    response = getPartnershipResponse(appUrl);
  } else {
    // Default fallback
    response = { "text": "Thank you for reaching out!" };
  }

  await callSendAPI(sender_psid, response, access_token);
}

async function callSendAPI(sender_psid, response, access_token) {
  if (!access_token) {
    console.error('PAGE_ACCESS_TOKEN is missing. Cannot send message.');
    return;
  }

  const requestBody = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  };

  try {
    const fetchResponse = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${access_token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const json = await fetchResponse.json();
    if (!fetchResponse.ok) {
      console.error('Failed calling Send API:', json);
    } else {
      console.log('Message sent successfully!');
    }
  } catch (err) {
    console.error('Error calling Send API:', err);
  }
}

// -------------------------------------------------------------
// Message Templates
// -------------------------------------------------------------

function getProductCarousel(appUrl) {
  return {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [
          {
            "title": "Classic Soft-Crust Cake",
            "image_url": `${appUrl}/images/classic.png`,
            "subtitle": "RM 9.90 • Vanilla bean & golden top. Best seller!",
            "buttons": [
              {
                "type": "web_url",
                "url": `${appUrl}/#products`,
                "title": "Order Online"
              }
            ]
          },
          {
            "title": "Dark Chocolate Soft-Crust",
            "image_url": `${appUrl}/images/chocolate.png`,
            "subtitle": "RM 9.90 • Premium dark chocolate. Popular!",
            "buttons": [
              {
                "type": "web_url",
                "url": `${appUrl}/#products`,
                "title": "Order Online"
              }
            ]
          },
          {
            "title": "Pandan Gold Soft-Crust",
            "image_url": `${appUrl}/images/pandan.png`,
            "subtitle": "RM 9.90 • Aromatic pandan infused. New!",
            "buttons": [
              {
                "type": "web_url",
                "url": `${appUrl}/#products`,
                "title": "Order Online"
              }
            ]
          },
          {
            "title": "Orange Zest Soft-Crust",
            "image_url": `${appUrl}/images/orange.png`,
            "subtitle": "RM 9.90 • Refreshing citrus taste.",
            "buttons": [
              {
                "type": "web_url",
                "url": `${appUrl}/#products`,
                "title": "Order Online"
              }
            ]
          }
        ]
      }
    }
  };
}

function getPartnershipResponse(appUrl) {
  return {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "We're expanding across KL & Selangor! 🤝\nJoin us as a Reseller, Café Partner, or Corporate Client.\n\nTap the button below to apply:",
        "buttons": [
          {
            "type": "web_url",
            "url": `${appUrl}/#partnership`,
            "title": "Apply for Partnership",
            "webview_height_ratio": "full"
          }
        ]
      }
    }
  };
}
