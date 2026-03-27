export default async function handler(req, res) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  // Handle Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    // We already have setup script, this is just for verification if needed
    return res.status(200).send('Setup script is working. Run POST /api/setup with a secret or hit it in browser to configure Messenger Profile.');
  }

  if (req.method === 'POST') {
    if (!PAGE_ACCESS_TOKEN) return res.status(500).json({ error: 'Missing token' });

    const setupData = {
      "persistent_menu": [
        {
          "locale": "default",
          "composer_input_disabled": false,
          "call_to_actions": [
            {
              "type": "postback",
              "title": "เมนูหลัก",
              "payload": "MAIN_MENU"
            },
            {
              "type": "postback",
              "title": "ติดต่อแอดมิน",
              "payload": "CONTACT_ADMIN"
            }
          ]
        }
      ],
      "ice_breakers": [
        {
          "call_to_actions": [
            {
              "question": "เมนูหลัก",
              "payload": "MAIN_MENU"
            },
            {
              "question": "ติดต่อแอดมิน",
              "payload": "CONTACT_ADMIN"
            }
          ],
          "locale": "default"
        }
      ]
    };

    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupData)
      });
      const data = await response.json();
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).send('Method Not Allowed');
}
