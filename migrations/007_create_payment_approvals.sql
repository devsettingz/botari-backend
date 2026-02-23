-- Payment Approvals Table
-- Handles the admin approval workflow for payments

CREATE TABLE IF NOT EXISTS payment_approvals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  business_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by INTEGER,
  rejection_reason TEXT,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_approvals_status ON payment_approvals(status);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_user_id ON payment_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_business_id ON payment_approvals(business_id);

-- Business Employees table (tracks which employees are active for each business)
CREATE TABLE IF NOT EXISTS business_employees (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, active, suspended
  hired_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(business_id, employee_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_business_employees_business_id ON business_employees(business_id);
CREATE INDEX IF NOT EXISTS idx_business_employees_employee_id ON business_employees(employee_id);
