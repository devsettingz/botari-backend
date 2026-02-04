import { Router } from 'express';
import pool from '../db';
import { verifyToken } from '../middleware/verifyToken';
import axios from 'axios';

const router = Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

// Initialize Paystack transaction
router.post('/initialize', verifyToken, async (req: any, res: any) => {
  const { employee_id, amount, email } = req.body;
  const businessId = req.user?.business_id || req.userId;
  const userId = req.user?.id || req.userId;

  if (!businessId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get employee details
    const empResult = await pool.query(
      'SELECT * FROM ai_employees WHERE id = $1',
      [employee_id]
    );
    
    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = empResult.rows[0];

    // Create pending subscription record
    const subResult = await pool.query(
      `INSERT INTO subscriptions (business_id, employee_id, status, amount, currency, provider) 
       VALUES ($1, $2, 'pending', $3, 'NGN', 'paystack') 
       RETURNING id`,
      [businessId, employee_id, amount]
    );
    
    const subscriptionId = subResult.rows[0].id;

    // Initialize Paystack transaction
    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email: email || req.user?.email || 'customer@business.com',
        amount: amount,
        metadata: {
          subscription_id: subscriptionId,
          business_id: businessId,
          employee_id: employee_id,
          user_id: userId,
          custom_fields: [
            {
              display_name: "Employee",
              variable_name: "employee_name",
              value: employee.display_name
            }
          ]
        },
        callback_url: `${process.env.FRONTEND_URL}/payment/verify`
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status) {
      // Update subscription with reference
      await pool.query(
        'UPDATE subscriptions SET provider_ref = $1 WHERE id = $2',
        [response.data.data.reference, subscriptionId]
      );

      res.json({
        authorization_url: response.data.data.authorization_url,
        reference: response.data.data.reference,
        subscription_id: subscriptionId
      });
    } else {
      throw new Error('Paystack initialization failed');
    }

  } catch (err: any) {
    console.error('Payment initialization error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

// Verify Paystack transaction
router.get('/verify/:reference', verifyToken, async (req: any, res: any) => {
  const { reference } = req.params;
  
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`
        }
      }
    );

    const { data } = response.data;
    
    if (data.status === 'success') {
      const { metadata } = data;
      
      // Update subscription to active
      await pool.query(
        `UPDATE subscriptions 
         SET status = 'active', activated_at = NOW(), expires_at = NOW() + INTERVAL '30 days'
         WHERE id = $1`,
        [metadata.subscription_id]
      );

      // Record payment
      await pool.query(
        `INSERT INTO payments (business_id, employee_id, amount, currency, provider, status, provider_ref, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          metadata.business_id,
          metadata.employee_id,
          data.amount,
          data.currency,
          'paystack',
          'completed',
          reference,
          JSON.stringify(data)
        ]
      );

      // Auto-hire the employee
      await pool.query(
        `INSERT INTO business_employees (business_id, employee_id, is_active, hired_at, assigned_channel)
         VALUES ($1, $2, true, NOW(), 'whatsapp')
         ON CONFLICT (business_id, employee_id) 
         DO UPDATE SET is_active = true, updated_at = NOW()`,
        [metadata.business_id, metadata.employee_id]
      );

      res.json({ 
        status: 'success', 
        message: 'Payment successful! Employee is now active.',
        employee_id: metadata.employee_id
      });
    } else {
      await pool.query(
        'UPDATE subscriptions SET status = $1 WHERE provider_ref = $2',
        [data.status, reference]
      );
      
      res.status(400).json({ 
        status: 'failed', 
        message: 'Payment verification failed' 
      });
    }

  } catch (err: any) {
    console.error('Verification error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Paystack Webhook (for async updates)
router.post('/webhook', async (req, res) => {
  const event = req.body;
  
  if (event.event === 'charge.success') {
    const { data } = event;
    const metadata = data.metadata;
    
    try {
      // Activate subscription
      await pool.query(
        `UPDATE subscriptions 
         SET status = 'active', activated_at = NOW(), expires_at = NOW() + INTERVAL '30 days'
         WHERE provider_ref = $1`,
        [data.reference]
      );

      // Ensure employee is hired
      await pool.query(
        `INSERT INTO business_employees (business_id, employee_id, is_active, hired_at)
         VALUES ($1, $2, true, NOW())
         ON CONFLICT (business_id, employee_id) 
         DO UPDATE SET is_active = true`,
        [metadata.business_id, metadata.employee_id]
      );

      console.log(`✅ Payment successful for business ${metadata.business_id}`);
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  }

  res.sendStatus(200);
});

export default router;