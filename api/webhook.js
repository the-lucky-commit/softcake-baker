export default async function handler(req, res) {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'softcake_baker_secret_token_2026';
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const LANDING_PAGE_URL = 'https://softcake-baker.vercel.app'; // เปลี่ยนเป็นโดเมนจริงเมื่อนำขึ้น Vercel

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
      // ส่ง Response กลับทันทีเพื่อยืนยันว่าได้รับ Event แล้ว (รักษากฎของ Webhook Meta)
      res.status(200).send('EVENT_RECEIVED');

      for (const entry of body.entry) {
        // รองรับทั้งกรณีปกติ (messaging) และกรณี Facebook Inbox แย่งรับข้อความ (standby)
        const events = entry.messaging || entry.standby || [];
        
        for (const webhook_event of events) {
          if (!webhook_event.sender || !webhook_event.sender.id) continue;
          
          const sender_psid = webhook_event.sender.id;
          
          if (webhook_event.postback) {
            await handlePostback(sender_psid, webhook_event.postback, PAGE_ACCESS_TOKEN, LANDING_PAGE_URL);
          } else if (webhook_event.message && !webhook_event.message.is_echo) {
            await handleMessage(sender_psid, webhook_event.message, PAGE_ACCESS_TOKEN, LANDING_PAGE_URL);
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
  // รองรับกรณีลูกค้าพิมพ์ข้อความตรงๆ
  const text = received_message.text ? received_message.text.toLowerCase() : '';
  
  if (text.includes('เมนูหลัก') || text.includes('เมนู') || text.includes('menu')) {
    await callSendAPI(sender_psid, getMainMenuCarousel(appUrl), access_token);
  } else if (text.includes('สนใจเค้กหน้านิ่ม') || text.includes('สนใจเค้ก')) {
    await triggerSoftcakeFlowStep1(sender_psid, access_token, appUrl);
  } else if (text.includes('สนใจ')) {
    await callSendAPI(sender_psid, getMainMenuCarousel(appUrl), access_token);
  } else {
    // ทักทายปกติ
    const genericResponse = {
      "text": "สวัสดีครับ 🙏 ร้าน Apple Bake ยินดีต้อนรับ\nกรุณากดปุ่มเพื่อเลือกดูรายการสินค้าครับ👇",
      "quick_replies": [
        {
          "content_type": "text",
          "title": "เมนูหลัก",
          "payload": "MAIN_MENU"
        }
      ]
    };
    await callSendAPI(sender_psid, genericResponse, access_token);
  }
}

async function handlePostback(sender_psid, received_postback, access_token, appUrl) {
  const payload = received_postback.payload;

  if (payload === 'MAIN_MENU') {
    // ลูกค้ากดเมนูหลักจาก Persistent Menu หรือ Ice Breaker
    await callSendAPI(sender_psid, getMainMenuCarousel(appUrl), access_token);
  } else if (payload === 'CONTACT_ADMIN') {
    await callSendAPI(sender_psid, { "text": "โปรดรอสักครู่ ทางแอดมินของเรากำลังจะมาตอบคำถามให้โดยเร็วที่สุดครับ 🙏🏻" }, access_token);
  } else if (payload === 'INTERESTED_SOFTCAKE') {
    // Step 1: ส่ง Pro 50 ท่านแรก
    await triggerSoftcakeFlowStep1(sender_psid, access_token, appUrl);
  } else if (payload === 'SOFTCAKE_DETAILS') {
    // Step 2: รายละเอียดหน้าเค้ก เงื่อนไข และปุ่มสั่งซื้อ
    await triggerSoftcakeFlowStep2(sender_psid, access_token);
  } else if (payload === 'ORDER_MENU') {
    // Step 3: การ์ดเลือกสถานที่ส่ง
    const responseText = { "text": "❤️ ราคาพิเศษ! Mini soft cake 1 กล่อง (42 ถ้วย) ราคา 2.9 ริง/ถ้วย\nหากสั่ง 10 กล่องขึ้นไป รับราคาพิเศษ 1.9 ริง/ถ้วย เท่านั้น! \n\n🚚 กรุณาเลือกลักษณะการรับสินค้าด้านล่างครับ👇" };
    await callSendAPI(sender_psid, responseText, access_token);
    await callSendAPI(sender_psid, getDeliveryOptionsCarousel(appUrl), access_token);
  } else if (payload.startsWith('DELIVERY_')) {
    // Step 4: ส่งข้อความให้คัดลอก + ปุ่มพาไป WhatsApp
    await triggerWhatsAppFlow(sender_psid, payload, access_token);
  } else {
    // อื่นๆ ที่ลูกค้าอาจจะกดจากการ์ด (เช่น ชีสเค้ก, รับสมัครงาน)
    await callSendAPI(sender_psid, { "text": "ฟังก์ชั่นนี้อยู่ระหว่างการปรับปรุงครับ ขอบคุณที่ให้ความสนใจ 🙏" }, access_token);
  }
}

async function callSendAPI(sender_psid, response, access_token) {
  if (!access_token) return;

  const requestBody = {
    "recipient": { "id": sender_psid },
    "message": response
  };

  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${access_token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch (err) {
    console.error('Error calling Send API:', err);
  }
}

// -------------------------------------------------------------
// Flow Specific Logic
// -------------------------------------------------------------

async function triggerSoftcakeFlowStep1(sender_psid, access_token, appUrl) {
  // Step 1: Promotion + Picture 
  const textMsg = { "text": "โปรสุด Hot 50 ท่านแรก 🔥\nเค้กถ้วยละ 1.9 ริง \n\nสามารถส่งได้ทุกพื้นที่ ทั่วมาเลเซีย 🇲🇾\nย้ำ โปรนี้ 50 ท่านแรกเท่านั้น!" };
  await callSendAPI(sender_psid, textMsg, access_token);

  // ภาพคนถือเค้กถุงมือดำ
  const imageMsg = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [
          {
            "title": "รับสิทธิ์โปรโมชั่น 1.9 ริง!",
            "image_url": `${appUrl}/images/hero.png`, // แนะนำให้เอารูปจริงมาใส่ในโฟลเดอร์ public/images/
            "subtitle": "คลิกปุ่มด้านล่างเพื่อดูรายละเอียดได้เลยครับ",
            "buttons": [
              {
                "type": "postback",
                "title": "รายละเอียด 📄",
                "payload": "SOFTCAKE_DETAILS"
              }
            ]
          }
        ]
      }
    }
  };
  await callSendAPI(sender_psid, imageMsg, access_token);
}

async function triggerSoftcakeFlowStep2(sender_psid, access_token) {
  // Step 2: 24 หน้าเค้ก
  const cakeList = `รายการหน้าเค้กทั้ง 24 หน้า:\n01 - บลูเบอรี่มาสเมโล่\n02 - สตอเบอรี่มาสเมโล่\n03 - สตอเบอรี่ ส้ม\n04 - Tripple bake\n05 - ชอกโกแลต\n06 - ส้ม\n07 - สตอเบอรี่ แอน ครีม\n08 - Green  and bake\n09 - blue and cream\n10 - Thai tea with jelly\n11 - ชาไทย\n12 - green and jelly\n13 - cream bake\n14 - Cream with ถั่ว\n15 - Cream with jelly\n16 - Orange with cream\n17 - cream with strawberry\n18 - สตอเบอรี่\n19 - Choco and cream\n20 - orange fruity\n21 - rainbow\n22 - Choco banana\n23 - jelly cream with caramel\n24 - mix bake`;
  await callSendAPI(sender_psid, { "text": cakeList }, access_token);

  const conditionText = `📍เงื่อนไขการสั่ง\n🕗 เวลาสั่งซื้อ: ทุกวัน 08:00 - 19:00 น.\n⏰ สรุปออเดอร์ก่อน 20:00 น.\n🍞 เริ่มผลิตทันทีในคืนนั้น\n\nการเก็บรักษา "เค้กหน้านิ่ม" 🍰\n❄️ อายุสินค้า 5-7 วัน (แช่เย็น 1-5 องศา นับจากวันรับ)\n‼️ ลูกค้าต้องแช่เย็นทันที ถ้าไม่แช่จะเสียภายใน 1 วัน`;
  await callSendAPI(sender_psid, { "text": conditionText }, access_token);

  // ส่งปุ่มสั่งซื้อ
  const buttonMsg = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "หากพร้อมสั่งซื้อแล้ว คลิกที่ปุ่มด้านล่างได้เลยครับ 👇",
        "buttons": [
          {
            "type": "postback",
            "title": "สั่งซื้อสินค้า 🛒",
            "payload": "ORDER_MENU"
          }
        ]
      }
    }
  };
  await callSendAPI(sender_psid, buttonMsg, access_token);
}

async function triggerWhatsAppFlow(sender_psid, payloadType, access_token) {
  let templateText = "";
  const whatsappNumber = "60111222333"; // เบอร์ WhatsApp ผู้ใช้ เปลี่ยนตรงนี้

  if (payloadType === "DELIVERY_PICKUP") {
    templateText = `คัดลอกข้อความข้างล่างนี้👇🏻\nเเล้วส่งไปที่ Whatsapp Admin ของร้าน\n\nพิม order mini soft cake\n** cod at shop **\n\n1.ส้ม =\n2.ช็อกโกแลตชิพ =\n3.ฝอยทอง =\n4.ช็อกโกบานาน่า =\n5.ไวท์ช็อกชิพแอนด์ครีม =\n6.ช็อกโกแลตส้ม =\n7.ช็อกชิพแอนด์ครีม =\n8.บลูเบอร์รี่แอนด์ครีม =\n9.โอรีโอ้ชิพแอนด์ครีม =\n10.สตอเบอร์รี่แอนด์ครีม =`;
  } else if (payloadType === "DELIVERY_KL") {
    templateText = `คัดลอกข้อความข้างล่างนี้👇🏻\nเเล้วส่งไปที่ Whatsapp Admin ของร้าน\n\nพิม order mini soft cake\n** Delivery (Kl / Selangor) **\n\n1.ส้ม =\n2.ช็อกโกแลตชิพ =\n3.ฝอยทอง =\n4.ช็อกโกบานาน่า =\n5.ไวท์ช็อกชิพแอนด์ครีม =\n6.ช็อกโกแลตส้ม =\n7.ช็อกชิพแอนด์ครีม =\n8.บลูเบอร์รี่แอนด์ครีม =\n9.โอรีโอ้ชิพแอนด์ครีม =\n10.สตอเบอร์รี่แอนด์ครีม =`;
  } else {
    templateText = `คัดลอกข้อความข้างล่างนี้👇🏻\nเเล้วส่งไปที่ Whatsapp Admin ของร้าน\n\nพิม order mini soft cake\n** Delivery (Nageri Lain2) **\n\n1.ส้ม =\n2.ช็อกโกแลตชิพ =\n3.ฝอยทอง =\n4.ช็อกโกบานาน่า =\n5.ไวท์ช็อกชิพแอนด์ครีม =\n6.ช็อกโกแลตส้ม =\n7.ช็อกชิพแอนด์ครีม =\n8.บลูเบอร์รี่แอนด์ครีม =\n9.โอรีโอ้ชิพแอนด์ครีม =\n10.สตอเบอร์รี่แอนด์ครีม =`;
  }

  await callSendAPI(sender_psid, { "text": templateText }, access_token);

  // ปุ่มกดส่งเข้า WhatsApp
  const waButton = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "คัดลอกข้อความด้านบนเสร็จแล้ว คลิกปุ่มด้านล่างเพื่อไปยังแอป WhatsApp ครับ 🟢",
        "buttons": [
          {
            "type": "web_url",
            "url": `https://wa.me/${whatsappNumber}`,
            "title": "ทัก WhatsApp 🟢"
          }
        ]
      }
    }
  };
  await callSendAPI(sender_psid, waButton, access_token);
}

// -------------------------------------------------------------
// Message Templates (Carousels)
// -------------------------------------------------------------

function getMainMenuCarousel(appUrl) {
  return {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "image_aspect_ratio": "square",
        "elements": [
          {
            "title": "ชีสเค้ก",
            "image_url": `${appUrl}/images/classic.png`, // Placeholder
            "subtitle": "ชีสเค้กมาแรง สุดติ่ง",
            "buttons": [
              { "type": "postback", "title": "สนใจเปิดร้านชีสเค้ก", "payload": "INTERESTED_CHEESECAKE" }
            ]
          },
          {
            "title": "เค้กหน้านิ่ม Apple Bake",
            "image_url": `${appUrl}/images/chocolate.png`, // Placeholder
            "subtitle": "มินิซอฟเค้กราคาคุ้มค่า เริ่มต้น 1.9 ริง!",
            "buttons": [
              { "type": "postback", "title": "สนใจเค้กหน้านิ่ม", "payload": "INTERESTED_SOFTCAKE" }
            ]
          },
          {
            "title": "ขนมอื่นๆ",
            "image_url": `${appUrl}/images/pandan.png`, // Placeholder
            "subtitle": "ขนมอื่นๆ ภายในร้าน Apple Bake",
            "buttons": [
              { "type": "postback", "title": "สนใจสินค้าอื่นๆ", "payload": "INTERESTED_OTHERS" }
            ]
          },
          {
            "title": "รับสมัครพนักงาน",
            "image_url": `${appUrl}/images/orange.png`, // Placeholder
            "subtitle": "ติดต่อสมัครงานตำแหน่งต่างๆ",
            "buttons": [
              { "type": "postback", "title": "สนใจสมัครงาน", "payload": "JOB_APPLICATION" }
            ]
          }
        ]
      }
    }
  };
}

function getDeliveryOptionsCarousel(appUrl) {
  return {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "image_aspect_ratio": "square",
        "elements": [
          {
            "title": "1️⃣ รับสินค้าเองหน้าโรงงาน",
            "image_url": `${appUrl}/images/classic.png`,
            "subtitle": "มารับเองที่สาขา สะดวกง่าย",
            "buttons": [
              { "type": "postback", "title": "เลือกการรับเอง", "payload": "DELIVERY_PICKUP" }
            ]
          },
          {
            "title": "2️⃣ Delivery (KL / Selangor)",
            "image_url": `${appUrl}/images/hero.png`,
            "subtitle": "ส่งภายใน 1-2 วัน (5 ลังส่งฟรี)",
            "buttons": [
              { "type": "postback", "title": "เลือกส่ง KL", "payload": "DELIVERY_KL" }
            ]
          },
          {
            "title": "3️⃣ Delivery (Nageri Lain)",
            "image_url": `${appUrl}/images/pandan.png`,
            "subtitle": "ผ่านทางขนส่งเอกชน (20 ลังส่งฟรี)",
            "buttons": [
              { "type": "postback", "title": "เลือกส่งต่างรัฐ", "payload": "DELIVERY_OTHER" }
            ]
          }
        ]
      }
    }
  };
}
