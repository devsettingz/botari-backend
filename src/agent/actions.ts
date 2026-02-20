/**
 * AI Agent Actions System - Action Handlers
 * Botari AI - Functional AI Employees
 * 
 * All business action handlers for inventory, appointments, orders, customers, and communication
 */

import pool from '../db';
import {
  ActionHandler,
  BusinessContext,
  ActionResult,
  OpenAIFunction,
  Product,
  Appointment,
  Order,
  OrderItem,
  Customer,
  FollowUp
} from './types';

// ============================================================================
// INVENTORY ACTIONS
// ============================================================================

const checkInventory: ActionHandler = {
  name: 'check_inventory',
  description: 'Check product stock availability and details',
  parameters: [
    {
      name: 'product_name',
      type: 'string',
      required: false,
      description: 'Name or partial name of the product to search for'
    },
    {
      name: 'product_id',
      type: 'number',
      required: false,
      description: 'Exact product ID if known'
    },
    {
      name: 'category',
      type: 'string',
      required: false,
      description: 'Filter by product category'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      let query = 'SELECT * FROM products WHERE business_id = $1 AND is_active = true';
      const queryParams: any[] = [context.business_id];
      let paramIndex = 2;

      if (params.product_id) {
        query += ` AND id = $${paramIndex}`;
        queryParams.push(params.product_id);
        paramIndex++;
      }

      if (params.product_name) {
        query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        queryParams.push(`%${params.product_name}%`);
        paramIndex++;
      }

      if (params.category) {
        query += ` AND category ILIKE $${paramIndex}`;
        queryParams.push(`%${params.category}%`);
        paramIndex++;
      }

      query += ' ORDER BY name LIMIT 20';

      const result = await pool.query(query, queryParams);
      const products: Product[] = result.rows;

      if (products.length === 0) {
        return {
          success: true,
          data: [],
          message: params.product_name
            ? `No products found matching "${params.product_name}"`
            : 'No products found in inventory'
        };
      }

      return {
        success: true,
        data: products,
        message: `Found ${products.length} product(s)`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to check inventory'
      };
    }
  }
};

const updateInventory: ActionHandler = {
  name: 'update_inventory',
  description: 'Update product stock quantity or details',
  parameters: [
    {
      name: 'product_id',
      type: 'number',
      required: true,
      description: 'ID of the product to update'
    },
    {
      name: 'quantity_change',
      type: 'number',
      required: false,
      description: 'Amount to add (positive) or remove (negative) from stock'
    },
    {
      name: 'new_quantity',
      type: 'number',
      required: false,
      description: 'Set absolute stock quantity (overrides quantity_change)'
    },
    {
      name: 'price',
      type: 'number',
      required: false,
      description: 'New price for the product'
    },
    {
      name: 'reason',
      type: 'string',
      required: false,
      description: 'Reason for inventory update'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.product_id) {
        return { success: false, error: 'Product ID is required' };
      }

      // Check product exists
      const checkResult = await pool.query(
        'SELECT * FROM products WHERE id = $1 AND business_id = $2',
        [params.product_id, context.business_id]
      );

      if (checkResult.rows.length === 0) {
        return { success: false, error: 'Product not found' };
      }

      const product = checkResult.rows[0];
      let updates: string[] = [];
      let updateParams: any[] = [];
      let paramIndex = 1;

      if (params.new_quantity !== undefined) {
        updates.push(`stock_quantity = $${paramIndex}`);
        updateParams.push(params.new_quantity);
        paramIndex++;
      } else if (params.quantity_change !== undefined) {
        updates.push(`stock_quantity = stock_quantity + $${paramIndex}`);
        updateParams.push(params.quantity_change);
        paramIndex++;
      }

      if (params.price !== undefined) {
        updates.push(`price = $${paramIndex}`);
        updateParams.push(params.price);
        paramIndex++;
      }

      if (updates.length === 0) {
        return { success: false, error: 'No updates provided' };
      }

      updateParams.push(params.product_id);
      updateParams.push(context.business_id);

      const updateQuery = `UPDATE products SET ${updates.join(', ')}, updated_at = NOW() 
                           WHERE id = $${paramIndex} AND business_id = $${paramIndex + 1} 
                           RETURNING *`;

      const result = await pool.query(updateQuery, updateParams);
      const updatedProduct: Product = result.rows[0];

      // Log inventory change
      await pool.query(
        `INSERT INTO inventory_logs (business_id, product_id, action, quantity_before, quantity_after, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          context.business_id,
          params.product_id,
          params.quantity_change ? (params.quantity_change > 0 ? 'restock' : 'sale') : 'adjustment',
          product.stock_quantity,
          updatedProduct.stock_quantity,
          params.reason || 'Agent update'
        ]
      );

      return {
        success: true,
        data: updatedProduct,
        message: `Updated ${updatedProduct.name}. Stock: ${product.stock_quantity} → ${updatedProduct.stock_quantity}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to update inventory'
      };
    }
  }
};

const checkPrice: ActionHandler = {
  name: 'check_price',
  description: 'Get current price for a product or service',
  parameters: [
    {
      name: 'product_name',
      type: 'string',
      required: false,
      description: 'Name of product to check price for'
    },
    {
      name: 'product_id',
      type: 'number',
      required: false,
      description: 'Product ID if known'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      let query = 'SELECT id, name, price, description, stock_quantity FROM products WHERE business_id = $1 AND is_active = true';
      const queryParams: any[] = [context.business_id];

      if (params.product_id) {
        query += ' AND id = $2';
        queryParams.push(params.product_id);
      } else if (params.product_name) {
        query += ' AND (name ILIKE $2 OR description ILIKE $2)';
        queryParams.push(`%${params.product_name}%`);
      }

      query += ' ORDER BY name LIMIT 10';

      const result = await pool.query(query, queryParams);
      const products = result.rows;

      if (products.length === 0) {
        return {
          success: true,
          data: [],
          message: params.product_name
            ? `No pricing found for "${params.product_name}"`
            : 'No products found'
        };
      }

      const priceList = products.map((p: Product) => ({
        name: p.name,
        price: p.price,
        in_stock: p.stock_quantity > 0,
        stock_quantity: p.stock_quantity
      }));

      return {
        success: true,
        data: priceList,
        message: `Found ${products.length} product(s) with pricing`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to check prices'
      };
    }
  }
};

// ============================================================================
// APPOINTMENT ACTIONS
// ============================================================================

const checkAvailability: ActionHandler = {
  name: 'check_availability',
  description: 'Check available time slots for appointments',
  parameters: [
    {
      name: 'date',
      type: 'string',
      required: true,
      description: 'Date to check (YYYY-MM-DD format)'
    },
    {
      name: 'duration_minutes',
      type: 'number',
      required: false,
      description: 'Duration needed in minutes (default 30)'
    },
    {
      name: 'service_type',
      type: 'string',
      required: false,
      description: 'Type of service to check availability for'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.date) {
        return { success: false, error: 'Date is required (YYYY-MM-DD)' };
      }

      const date = params.date;
      const duration = params.duration_minutes || 30;

      // Get existing appointments for that date
      const appointmentsResult = await pool.query(
        `SELECT scheduled_at, duration_minutes FROM appointments 
         WHERE business_id = $1 
         AND DATE(scheduled_at) = $2 
         AND status IN ('pending', 'confirmed')`,
        [context.business_id, date]
      );

      // Define business hours (9 AM to 6 PM)
      const businessHours = { start: 9, end: 18 };
      const slots: string[] = [];

      for (let hour = businessHours.start; hour < businessHours.end; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const slotTime = new Date(`${date}T${timeStr}:00`);

          // Check if slot conflicts with existing appointments
          const isAvailable = !appointmentsResult.rows.some((apt: Appointment) => {
            const aptStart = new Date(apt.scheduled_at);
            const aptEnd = new Date(aptStart.getTime() + (apt.duration_minutes || 30) * 60000);
            const slotEnd = new Date(slotTime.getTime() + duration * 60000);
            return slotTime < aptEnd && slotEnd > aptStart;
          });

          if (isAvailable && slotTime > new Date()) {
            slots.push(timeStr);
          }
        }
      }

      return {
        success: true,
        data: {
          date,
          available_slots: slots,
          duration_minutes: duration
        },
        message: slots.length > 0
          ? `Found ${slots.length} available slots on ${date}`
          : `No available slots on ${date}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to check availability'
      };
    }
  }
};

const bookAppointment: ActionHandler = {
  name: 'book_appointment',
  description: 'Book a new appointment for a customer',
  parameters: [
    {
      name: 'customer_phone',
      type: 'string',
      required: true,
      description: 'Customer phone number'
    },
    {
      name: 'date',
      type: 'string',
      required: true,
      description: 'Appointment date (YYYY-MM-DD)'
    },
    {
      name: 'time',
      type: 'string',
      required: true,
      description: 'Appointment time (HH:MM)'
    },
    {
      name: 'service_name',
      type: 'string',
      required: false,
      description: 'Name of service being booked'
    },
    {
      name: 'duration_minutes',
      type: 'number',
      required: false,
      description: 'Duration in minutes (default 30)'
    },
    {
      name: 'notes',
      type: 'string',
      required: false,
      description: 'Additional notes for the appointment'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.customer_phone || !params.date || !params.time) {
        return { success: false, error: 'Customer phone, date, and time are required' };
      }

      const scheduledAt = new Date(`${params.date}T${params.time}:00`);

      if (scheduledAt < new Date()) {
        return { success: false, error: 'Cannot book appointments in the past' };
      }

      // Check for conflicts
      const duration = params.duration_minutes || 30;
      const conflictCheck = await pool.query(
        `SELECT * FROM appointments 
         WHERE business_id = $1 
         AND scheduled_at < $2 
         AND scheduled_at + INTERVAL '1 minute' * COALESCE(duration_minutes, 30) > $3
         AND status IN ('pending', 'confirmed')`,
        [context.business_id, new Date(scheduledAt.getTime() + duration * 60000), scheduledAt]
      );

      if (conflictCheck.rows.length > 0) {
        return { success: false, error: 'Time slot is no longer available' };
      }

      // Get or create customer
      let customerResult = await pool.query(
        'SELECT id FROM customers WHERE business_id = $1 AND phone = $2',
        [context.business_id, params.customer_phone]
      );

      if (customerResult.rows.length === 0) {
        customerResult = await pool.query(
          'INSERT INTO customers (business_id, phone, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
          [context.business_id, params.customer_phone]
        );
      }

      const result = await pool.query(
        `INSERT INTO appointments 
         (business_id, customer_phone, employee_id, scheduled_at, duration_minutes, 
          service_name, notes, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', NOW(), NOW())
         RETURNING *`,
        [
          context.business_id,
          params.customer_phone,
          context.employee_id,
          scheduledAt,
          duration,
          params.service_name || null,
          params.notes || null
        ]
      );

      const appointment: Appointment = result.rows[0];

      return {
        success: true,
        data: appointment,
        message: `Appointment booked for ${params.date} at ${params.time}${params.service_name ? ` (${params.service_name})` : ''}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to book appointment'
      };
    }
  }
};

const cancelAppointment: ActionHandler = {
  name: 'cancel_appointment',
  description: 'Cancel an existing appointment',
  parameters: [
    {
      name: 'appointment_id',
      type: 'number',
      required: true,
      description: 'ID of the appointment to cancel'
    },
    {
      name: 'reason',
      type: 'string',
      required: false,
      description: 'Reason for cancellation'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.appointment_id) {
        return { success: false, error: 'Appointment ID is required' };
      }

      const checkResult = await pool.query(
        'SELECT * FROM appointments WHERE id = $1 AND business_id = $2',
        [params.appointment_id, context.business_id]
      );

      if (checkResult.rows.length === 0) {
        return { success: false, error: 'Appointment not found' };
      }

      const appointment = checkResult.rows[0];

      if (appointment.status === 'cancelled') {
        return { success: false, error: 'Appointment is already cancelled' };
      }

      const result = await pool.query(
        `UPDATE appointments 
         SET status = 'cancelled', notes = COALESCE(notes, '') || $3, updated_at = NOW()
         WHERE id = $1 AND business_id = $2
         RETURNING *`,
        [
          params.appointment_id,
          context.business_id,
          params.reason ? `\nCancelled: ${params.reason}` : '\nCancelled by agent'
        ]
      );

      return {
        success: true,
        data: result.rows[0],
        message: `Appointment #${params.appointment_id} cancelled successfully`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to cancel appointment'
      };
    }
  }
};

const listAppointments: ActionHandler = {
  name: 'list_appointments',
  description: 'List upcoming appointments',
  parameters: [
    {
      name: 'customer_phone',
      type: 'string',
      required: false,
      description: 'Filter by customer phone number'
    },
    {
      name: 'date_from',
      type: 'string',
      required: false,
      description: 'Start date (YYYY-MM-DD)'
    },
    {
      name: 'date_to',
      type: 'string',
      required: false,
      description: 'End date (YYYY-MM-DD)'
    },
    {
      name: 'status',
      type: 'string',
      required: false,
      description: 'Filter by status: pending, confirmed, cancelled, completed',
      enum: ['pending', 'confirmed', 'cancelled', 'completed']
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      description: 'Maximum number of results (default 10)'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      let query = `SELECT a.*, c.name as customer_name 
                   FROM appointments a
                   LEFT JOIN customers c ON a.business_id = c.business_id AND a.customer_phone = c.phone
                   WHERE a.business_id = $1`;
      const queryParams: any[] = [context.business_id];
      let paramIndex = 2;

      if (params.customer_phone) {
        query += ` AND a.customer_phone = $${paramIndex}`;
        queryParams.push(params.customer_phone);
        paramIndex++;
      }

      if (params.date_from) {
        query += ` AND DATE(a.scheduled_at) >= $${paramIndex}`;
        queryParams.push(params.date_from);
        paramIndex++;
      } else {
        // Default to today onwards
        query += ` AND a.scheduled_at >= $${paramIndex}`;
        queryParams.push(new Date().toISOString().split('T')[0]);
        paramIndex++;
      }

      if (params.date_to) {
        query += ` AND DATE(a.scheduled_at) <= $${paramIndex}`;
        queryParams.push(params.date_to);
        paramIndex++;
      }

      if (params.status) {
        query += ` AND a.status = $${paramIndex}`;
        queryParams.push(params.status);
        paramIndex++;
      } else {
        query += ` AND a.status IN ('pending', 'confirmed')`;
      }

      query += ` ORDER BY a.scheduled_at ASC LIMIT $${paramIndex}`;
      queryParams.push(params.limit || 10);

      const result = await pool.query(query, queryParams);
      const appointments: Appointment[] = result.rows;

      return {
        success: true,
        data: appointments,
        message: appointments.length > 0
          ? `Found ${appointments.length} appointment(s)`
          : 'No upcoming appointments found'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to list appointments'
      };
    }
  }
};

// ============================================================================
// ORDER ACTIONS
// ============================================================================

const takeOrder: ActionHandler = {
  name: 'take_order',
  description: 'Create a new order for a customer',
  parameters: [
    {
      name: 'customer_phone',
      type: 'string',
      required: true,
      description: 'Customer phone number'
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      description: 'Array of order items with product_id and quantity'
    },
    {
      name: 'notes',
      type: 'string',
      required: false,
      description: 'Additional order notes'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.customer_phone || !params.items || !Array.isArray(params.items) || params.items.length === 0) {
        return { success: false, error: 'Customer phone and items are required' };
      }

      // Validate and calculate order
      const orderItems: OrderItem[] = [];
      let totalAmount = 0;

      for (const item of params.items) {
        const productResult = await pool.query(
          'SELECT * FROM products WHERE id = $1 AND business_id = $2 AND is_active = true',
          [item.product_id, context.business_id]
        );

        if (productResult.rows.length === 0) {
          return { success: false, error: `Product ID ${item.product_id} not found` };
        }

        const product: Product = productResult.rows[0];

        if (product.stock_quantity < item.quantity) {
          return {
            success: false,
            error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`
          };
        }

        const itemTotal = product.price * item.quantity;
        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price,
          total_price: itemTotal
        });
        totalAmount += itemTotal;

        // Update inventory
        await pool.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2',
          [item.quantity, product.id]
        );
      }

      // Get or create customer
      let customerResult = await pool.query(
        'SELECT id FROM customers WHERE business_id = $1 AND phone = $2',
        [context.business_id, params.customer_phone]
      );

      if (customerResult.rows.length === 0) {
        await pool.query(
          'INSERT INTO customers (business_id, phone, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
          [context.business_id, params.customer_phone]
        );
      }

      // Create order
      const result = await pool.query(
        `INSERT INTO orders 
         (business_id, customer_phone, items, total_amount, status, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), NOW())
         RETURNING *`,
        [
          context.business_id,
          params.customer_phone,
          JSON.stringify(orderItems),
          totalAmount,
          params.notes || null
        ]
      );

      const order: Order = result.rows[0];

      return {
        success: true,
        data: order,
        message: `Order #${order.id} created. Total: $${totalAmount.toFixed(2)} (${orderItems.length} item(s))`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to create order'
      };
    }
  }
};

const checkOrderStatus: ActionHandler = {
  name: 'check_order_status',
  description: 'Check status of an existing order',
  parameters: [
    {
      name: 'order_id',
      type: 'number',
      required: false,
      description: 'Order ID to check'
    },
    {
      name: 'customer_phone',
      type: 'string',
      required: false,
      description: 'Filter by customer phone to see their recent orders'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (params.order_id) {
        const result = await pool.query(
          'SELECT * FROM orders WHERE id = $1 AND business_id = $2',
          [params.order_id, context.business_id]
        );

        if (result.rows.length === 0) {
          return { success: false, error: 'Order not found' };
        }

        return {
          success: true,
          data: result.rows[0],
          message: `Order #${params.order_id} status: ${result.rows[0].status}`
        };
      }

      if (params.customer_phone) {
        const result = await pool.query(
          `SELECT * FROM orders 
           WHERE business_id = $1 AND customer_phone = $2 
           ORDER BY created_at DESC LIMIT 5`,
          [context.business_id, params.customer_phone]
        );

        return {
          success: true,
          data: result.rows,
          message: `Found ${result.rows.length} order(s) for ${params.customer_phone}`
        };
      }

      return { success: false, error: 'Order ID or customer phone required' };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to check order status'
      };
    }
  }
};

const cancelOrder: ActionHandler = {
  name: 'cancel_order',
  description: 'Cancel an existing order',
  parameters: [
    {
      name: 'order_id',
      type: 'number',
      required: true,
      description: 'Order ID to cancel'
    },
    {
      name: 'reason',
      type: 'string',
      required: false,
      description: 'Reason for cancellation'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.order_id) {
        return { success: false, error: 'Order ID is required' };
      }

      const checkResult = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND business_id = $2',
        [params.order_id, context.business_id]
      );

      if (checkResult.rows.length === 0) {
        return { success: false, error: 'Order not found' };
      }

      const order: Order = checkResult.rows[0];

      if (order.status === 'cancelled') {
        return { success: false, error: 'Order is already cancelled' };
      }

      if (order.status === 'delivered' || order.status === 'shipped') {
        return { success: false, error: `Cannot cancel order that is already ${order.status}` };
      }

      // Restore inventory
      for (const item of order.items) {
        await pool.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }

      const result = await pool.query(
        `UPDATE orders 
         SET status = 'cancelled', notes = COALESCE(notes, '') || $3, updated_at = NOW()
         WHERE id = $1 AND business_id = $2
         RETURNING *`,
        [
          params.order_id,
          context.business_id,
          params.reason ? `\nCancelled: ${params.reason}` : '\nCancelled by agent'
        ]
      );

      return {
        success: true,
        data: result.rows[0],
        message: `Order #${params.order_id} cancelled. Inventory restored.`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to cancel order'
      };
    }
  }
};

// ============================================================================
// CUSTOMER ACTIONS
// ============================================================================

const findCustomer: ActionHandler = {
  name: 'find_customer',
  description: 'Search for customer by phone or name',
  parameters: [
    {
      name: 'phone',
      type: 'string',
      required: false,
      description: 'Customer phone number'
    },
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Customer name (partial match)'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      let query = 'SELECT * FROM customers WHERE business_id = $1';
      const queryParams: any[] = [context.business_id];
      let paramIndex = 2;

      if (params.phone) {
        query += ` AND phone ILIKE $${paramIndex}`;
        queryParams.push(`%${params.phone}%`);
        paramIndex++;
      }

      if (params.name) {
        query += ` AND name ILIKE $${paramIndex}`;
        queryParams.push(`%${params.name}%`);
        paramIndex++;
      }

      if (!params.phone && !params.name) {
        return { success: false, error: 'Phone or name is required to search' };
      }

      query += ' ORDER BY name LIMIT 10';

      const result = await pool.query(query, queryParams);
      const customers: Customer[] = result.rows;

      return {
        success: true,
        data: customers,
        message: customers.length > 0
          ? `Found ${customers.length} customer(s)`
          : 'No customers found matching your search'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to find customer'
      };
    }
  }
};

const createCustomer: ActionHandler = {
  name: 'create_customer',
  description: 'Create a new customer record',
  parameters: [
    {
      name: 'phone',
      type: 'string',
      required: true,
      description: 'Customer phone number (required)'
    },
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Customer full name'
    },
    {
      name: 'email',
      type: 'string',
      required: false,
      description: 'Customer email address'
    },
    {
      name: 'address',
      type: 'string',
      required: false,
      description: 'Customer address'
    },
    {
      name: 'notes',
      type: 'string',
      required: false,
      description: 'Additional notes about the customer'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.phone) {
        return { success: false, error: 'Phone number is required' };
      }

      // Check if customer already exists
      const existingResult = await pool.query(
        'SELECT * FROM customers WHERE business_id = $1 AND phone = $2',
        [context.business_id, params.phone]
      );

      if (existingResult.rows.length > 0) {
        return {
          success: false,
          error: 'Customer with this phone number already exists',
          data: existingResult.rows[0]
        };
      }

      const result = await pool.query(
        `INSERT INTO customers 
         (business_id, phone, name, email, address, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [
          context.business_id,
          params.phone,
          params.name || null,
          params.email || null,
          params.address || null,
          params.notes || null
        ]
      );

      return {
        success: true,
        data: result.rows[0],
        message: `Customer ${params.name || params.phone} created successfully`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to create customer'
      };
    }
  }
};

const updateCustomer: ActionHandler = {
  name: 'update_customer',
  description: 'Update existing customer information',
  parameters: [
    {
      name: 'customer_id',
      type: 'number',
      required: true,
      description: 'Customer ID to update'
    },
    {
      name: 'name',
      type: 'string',
      required: false,
      description: 'Updated full name'
    },
    {
      name: 'email',
      type: 'string',
      required: false,
      description: 'Updated email address'
    },
    {
      name: 'address',
      type: 'string',
      required: false,
      description: 'Updated address'
    },
    {
      name: 'notes',
      type: 'string',
      required: false,
      description: 'Updated notes'
    },
    {
      name: 'add_tags',
      type: 'array',
      required: false,
      description: 'Tags to add to customer'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.customer_id) {
        return { success: false, error: 'Customer ID is required' };
      }

      const updates: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (params.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        updateParams.push(params.name);
        paramIndex++;
      }

      if (params.email !== undefined) {
        updates.push(`email = $${paramIndex}`);
        updateParams.push(params.email);
        paramIndex++;
      }

      if (params.address !== undefined) {
        updates.push(`address = $${paramIndex}`);
        updateParams.push(params.address);
        paramIndex++;
      }

      if (params.notes !== undefined) {
        updates.push(`notes = $${paramIndex}`);
        updateParams.push(params.notes);
        paramIndex++;
      }

      if (params.add_tags && Array.isArray(params.add_tags)) {
        updates.push(`tags = COALESCE(tags, ARRAY[]::text[]) || $${paramIndex}::text[]`);
        updateParams.push(params.add_tags);
        paramIndex++;
      }

      if (updates.length === 0) {
        return { success: false, error: 'No updates provided' };
      }

      updates.push(`updated_at = NOW()`);
      updateParams.push(params.customer_id);
      updateParams.push(context.business_id);

      const updateQuery = `UPDATE customers SET ${updates.join(', ')} 
                           WHERE id = $${paramIndex} AND business_id = $${paramIndex + 1} 
                           RETURNING *`;

      const result = await pool.query(updateQuery, updateParams);

      if (result.rows.length === 0) {
        return { success: false, error: 'Customer not found' };
      }

      return {
        success: true,
        data: result.rows[0],
        message: `Customer #${params.customer_id} updated successfully`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to update customer'
      };
    }
  }
};

// ============================================================================
// COMMUNICATION ACTIONS
// ============================================================================

const sendEmail: ActionHandler = {
  name: 'send_email',
  description: 'Send an email to a customer (logs the intent, requires external email service)',
  parameters: [
    {
      name: 'to_email',
      type: 'string',
      required: true,
      description: 'Recipient email address'
    },
    {
      name: 'subject',
      type: 'string',
      required: true,
      description: 'Email subject'
    },
    {
      name: 'body',
      type: 'string',
      required: true,
      description: 'Email body content'
    },
    {
      name: 'template',
      type: 'string',
      required: false,
      description: 'Email template to use'
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.to_email || !params.subject || !params.body) {
        return { success: false, error: 'To email, subject, and body are required' };
      }

      // Store email log for processing by external service
      const result = await pool.query(
        `INSERT INTO email_queue 
         (business_id, to_email, subject, body, template, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
         RETURNING *`,
        [
          context.business_id,
          params.to_email,
          params.subject,
          params.body,
          params.template || null
        ]
      );

      return {
        success: true,
        data: result.rows[0],
        message: `Email queued for ${params.to_email}. Subject: "${params.subject}"`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to queue email'
      };
    }
  }
};

const scheduleFollowup: ActionHandler = {
  name: 'schedule_followup',
  description: 'Schedule a follow-up reminder for a customer',
  parameters: [
    {
      name: 'customer_phone',
      type: 'string',
      required: true,
      description: 'Customer phone number'
    },
    {
      name: 'scheduled_at',
      type: 'string',
      required: true,
      description: 'When to follow up (ISO datetime or relative like "tomorrow 2pm")'
    },
    {
      name: 'notes',
      type: 'string',
      required: true,
      description: 'What to follow up about'
    },
    {
      name: 'channel',
      type: 'string',
      required: false,
      description: 'Channel for follow-up: whatsapp, sms, email, call',
      enum: ['whatsapp', 'sms', 'email', 'call']
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.customer_phone || !params.scheduled_at || !params.notes) {
        return { success: false, error: 'Customer phone, scheduled time, and notes are required' };
      }

      // Parse scheduled_at
      let scheduledDate: Date;
      const lowerSchedule = params.scheduled_at.toLowerCase();

      if (lowerSchedule.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const timeMatch = params.scheduled_at.match(/(\d+):?(\d*)\s*(am|pm)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const ampm = timeMatch[3];
          if (ampm?.toLowerCase() === 'pm' && hours < 12) hours += 12;
          if (ampm?.toLowerCase() === 'am' && hours === 12) hours = 0;
          tomorrow.setHours(hours, minutes, 0, 0);
        }
        scheduledDate = tomorrow;
      } else if (lowerSchedule.includes('next week')) {
        scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 7);
      } else {
        scheduledDate = new Date(params.scheduled_at);
      }

      if (isNaN(scheduledDate.getTime())) {
        return { success: false, error: 'Invalid scheduled date format' };
      }

      const result = await pool.query(
        `INSERT INTO follow_ups 
         (business_id, customer_phone, scheduled_at, notes, channel, status, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())
         RETURNING *`,
        [
          context.business_id,
          params.customer_phone,
          scheduledDate,
          params.notes,
          params.channel || 'whatsapp',
          context.employee_name || 'AI Agent'
        ]
      );

      const followUp: FollowUp = result.rows[0];

      return {
        success: true,
        data: followUp,
        message: `Follow-up scheduled for ${scheduledDate.toLocaleDateString()} at ${scheduledDate.toLocaleTimeString()}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to schedule follow-up'
      };
    }
  }
};

const escalateToHuman: ActionHandler = {
  name: 'escalate_to_human',
  description: 'Hand off conversation to a human agent',
  parameters: [
    {
      name: 'reason',
      type: 'string',
      required: true,
      description: 'Reason for escalation'
    },
    {
      name: 'priority',
      type: 'string',
      required: false,
      description: 'Priority level: low, medium, high, urgent',
      enum: ['low', 'medium', 'high', 'urgent']
    }
  ],
  execute: async (params, context): Promise<ActionResult> => {
    try {
      if (!params.reason) {
        return { success: false, error: 'Reason for escalation is required' };
      }

      // Update conversation status
      if (context.conversation_id) {
        await pool.query(
          `UPDATE conversations 
           SET status = 'escalated', escalation_reason = $2, escalation_priority = $3, updated_at = NOW()
           WHERE id = $1`,
          [context.conversation_id, params.reason, params.priority || 'medium']
        );
      }

      // Log escalation
      await pool.query(
        `INSERT INTO escalations 
         (business_id, conversation_id, customer_phone, reason, priority, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
        [
          context.business_id,
          context.conversation_id,
          context.customer_phone,
          params.reason,
          params.priority || 'medium'
        ]
      );

      return {
        success: true,
        data: {
          escalated: true,
          priority: params.priority || 'medium',
          estimated_response: 'A human agent will respond within 15 minutes'
        },
        message: `Escalated to human support. Priority: ${params.priority || 'medium'}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to escalate'
      };
    }
  }
};

// ============================================================================
// ACTION REGISTRY
// ============================================================================

// All available actions
export const ALL_ACTIONS: ActionHandler[] = [
  // Inventory
  checkInventory,
  updateInventory,
  checkPrice,
  // Appointments
  checkAvailability,
  bookAppointment,
  cancelAppointment,
  listAppointments,
  // Orders
  takeOrder,
  checkOrderStatus,
  cancelOrder,
  // Customers
  findCustomer,
  createCustomer,
  updateCustomer,
  // Communication
  sendEmail,
  scheduleFollowup,
  escalateToHuman
];

// Actions by employee type
export const EMPLOYEE_ACTIONS: { [key: string]: string[] } = {
  amina: ['check_inventory', 'update_inventory', 'check_price', 'check_availability', 'book_appointment', 
          'cancel_appointment', 'list_appointments', 'take_order', 'check_order_status', 'cancel_order',
          'find_customer', 'create_customer', 'update_customer', 'schedule_followup', 'escalate_to_human'],
  stan: ['find_customer', 'create_customer', 'update_customer', 'schedule_followup', 'send_email', 'escalate_to_human'],
  eva: ['find_customer', 'create_customer', 'update_customer', 'send_email', 'schedule_followup', 'escalate_to_human'],
  rachel: ['check_availability', 'book_appointment', 'cancel_appointment', 'list_appointments', 
           'find_customer', 'create_customer', 'schedule_followup', 'escalate_to_human'],
  sonny: ['send_email', 'schedule_followup', 'escalate_to_human'],
  penny: ['send_email', 'schedule_followup', 'escalate_to_human'],
  linda: ['send_email', 'schedule_followup', 'escalate_to_human']
};

// Get actions available to a specific employee type
export function getEmployeeActions(employeeType: string): ActionHandler[] {
  const allowedActions = EMPLOYEE_ACTIONS[employeeType.toLowerCase()] || [];
  return ALL_ACTIONS.filter(action => allowedActions.includes(action.name));
}

// Get a specific action by name
export function getAction(name: string): ActionHandler | undefined {
  return ALL_ACTIONS.find(action => action.name === name);
}

// Convert action to OpenAI function schema
export function actionToOpenAIFunction(action: ActionHandler): OpenAIFunction {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const param of action.parameters) {
    properties[param.name] = {
      type: param.type,
      description: param.description
    };
    if (param.enum) {
      properties[param.name].enum = param.enum;
    }
    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    type: 'function',
    function: {
      name: action.name,
      description: action.description,
      parameters: {
        type: 'object',
        properties,
        required
      }
    }
  };
}

// Get OpenAI tools for an employee
export function getEmployeeTools(employeeType: string): OpenAIFunction[] {
  const actions = getEmployeeActions(employeeType);
  return actions.map(actionToOpenAIFunction);
}
