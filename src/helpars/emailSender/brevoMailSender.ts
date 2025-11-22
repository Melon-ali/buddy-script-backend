import axios from 'axios';
import config from '../../config';

const emailSender = async (email: string, html: string, subject: string) => {
  if (!config.brevoMail.api_key) {
    throw new Error('Missing Brevo API key');
  }

  try {
    const payload = {
      sender: {
        name: "SocialWave",
        email: "svetlana.shabdeen@gmail.com"
      },
      to: [
        {
          email: email
        }
      ],
      htmlContent: html,
      subject: subject
    };

    // Log the exact payload being sent
    console.log('Sending email with payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'accept': 'application/json',
        'api-key': config.brevoMail.api_key,
        'content-type': 'application/json'
      }
    });

    return response.data;
  } catch (error: any) {
    // Enhanced error logging
    if (error.response) {
      console.error('Brevo API Error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
        requestPayload: error.config?.data ? JSON.parse(error.config.data) : null
      });
    }
    throw new Error(error.response?.data?.message || 'Failed to send email');
  }
};

export default emailSender;
