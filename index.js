const express = require("express");
var mysql = require("mysql2");
//const session = require('express-session');
const app = express();
const port = 3001;
const path = require("path");
app.use(express.urlencoded({ extended: true })); // Parses form data (application/x-www-form-urlencoded)
app.use(express.json()); // Parses JSON data


app.listen(port, function() {                          // connecting to a server
    console.log(`Listening on port ${port}...`);  
});

var connection = mysql.createConnection({  
    host: "localhost",          
    user: "root",  
    password: "Fabrics2#",
    database: "fabrics1"                
});

connection.connect(function(err) {                // connecting to DBMS
    if (err) throw err;  
    console.log("Connected!");  
});


// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Use express-session to handle sessions
/*app.use(session({
  secret: 'chfabrics', // Change to a secure key
  resave: false,
  saveUninitialized: true
}));*/
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const userSql = 'SELECT Gmail, Password FROM Login WHERE Gmail = ?';

    connection.query(userSql, [username], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.status(401).send('No such user found');
        }

        // Retrieve the user ID and plaintext password from the database
        const { UserID, Password: storedPassword } = results[0];

        // Direct comparison of plaintext passwords
        if (password === storedPassword) {
            res.sendFile(path.join(__dirname, 'public', 'report.html'));
            
        } else {
            res.status(401).send('Password incorrect');
        }
       // req.session.user = { id: user.id, username: user.username };
       // res.status(200).json({ success: true, message: 'Logged in successfully!' });
    });
});
/*
// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next(); // Proceed if user is logged in
  }
  return res.status(403).json({ success: false, message: 'You need to log in first.' });
}

// Protected route (example)
app.get('/protected', isAuthenticated, (req, res) => {
  res.json({ success: true, message: 'This is a protected route!' });
});
*/
// API to fetch all expenses
app.get('/expenses', (req, res) => {
    const query = 'SELECT * FROM Expenses ORDER BY DateTime DESC';
    connection.query(query, (err, results) => {
      if (err) throw err;
      res.json(results);
    });
  });
  
  // API to add a new expense
  app.post('/expenses', (req, res) => {
    const { ExpenseName, TotalAmount, DateTime } = req.body;
    const expenseDateTime = DateTime ? new Date(DateTime).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
    const query = 'INSERT INTO Expenses (ExpenseName, TotalAmount, DateTime) VALUES (?, ?, ?)';
    connection.query(query, [ExpenseName, TotalAmount, expenseDateTime], (err, results) => {
      if (err) throw err;
      res.status(201).send('Expense added successfully.');
    });
  });
// Route to fetch inventory records
app.get("/api/inventory", (req, res) => {
    const sql = "SELECT * FROM Inventory";
    connection.query(sql, (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Database query failed." });
      }
      res.json(results);
    });
  });
  
  // Route to add a new product
  app.post("/api/inventory", (req, res) => {
    const { productName, pricePerMeter, quantity } = req.body;
    const totalAmount = pricePerMeter * quantity;
    const sql = "INSERT INTO Inventory (ProductName, PricePerMeter, Quantity, TotalAmount, Remaining) VALUES (?, ?, ?, ?,?)";
    connection.query(sql, [productName, pricePerMeter, quantity, totalAmount,quantity], (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Database query failed." });
      }
      res.json({ message: "Product added successfully.", productID: result.insertId });
    });
  });
// Endpoint to fetch all orders
app.get('/orders', (req, res) => {
    const query = 'SELECT c.CompanyOrderID AS CompanyID,c.CompanyName ,c.Address,c.PhoneNo FROM  CompanyOrders c ;';
    connection.query(query, (err, results) => {
      if (err) throw err;
      res.json(results);
    });
  });
  // API to get order history by company ID
  app.get('/orders/history/:companyID', (req, res) => {
    const companyID = req.params.companyID;
  
    // Step 1: Fetch the OrderIDs for the given CompanyID from CompanyOrders table
    const getOrderIDsQuery = 'SELECT OrderID FROM CompanyOrders WHERE CompanyOrderID = ?';
  
    connection.query(getOrderIDsQuery, [companyID], (err, results) => {
      if (err) {
        console.error('Error fetching order IDs:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
  
      // Ensure the OrderIDs are not empty and split them into an array
      const orderIDs = results[0]?.OrderID?.split(',').map(id => parseInt(id, 10)) || [];
  
      // If no OrderIDs are found, return an empty response
      if (orderIDs.length === 0) {
        return res.status(404).json({ message: 'No orders found for this company.' });
      }
  
      // Step 2: Fetch the order details for the retrieved OrderIDs
      const orderHistoryQuery = `
    SELECT 
    o.OrderID, 
    i.ProductName, 
    o.Quantity, 
    o.Price, 
    o.DateTime, 
    o.TotalBill,
    p.AmountRemaining
    
FROM Orders o
JOIN Inventory i ON o.Product = i.ProductID
LEFT JOIN Payments p ON o.OrderID = p.OrderID
WHERE o.OrderID IN (?)
ORDER BY o.DateTime DESC;

`;

  
      connection.query(orderHistoryQuery, [orderIDs], (err, orderHistory) => {
        if (err) {
          console.error('Error fetching order history:', err);
          return res.status(500).json({ error: 'Internal Server Error' });
        }
  
        // Return the order history as a JSON response
        res.json(orderHistory);
      });
    });
  });
  app.use(express.json());
  // Route to place an order for a product
app.post('/placeorders', (req, res) => {
    const { companyID, productID, quantity, price, paidamount } = req.body;

    if (!companyID || !productID || !quantity || !price) {
        return res.status(400).json({ message: 'All fields are required: companyID, productID, quantity, and price.' });
    }

    // Calculate total price
    const totalPrice = quantity * price;
    const orderDateTime = new Date().toISOString();  // Set current date-time as order timestamp

    // Insert the order into the Orders table
    const query = `
        INSERT INTO Orders (CompanyOrderID, ProductID, Quantity, Price, TotalPrice, DateTime)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    connection.query(query, [companyID, productID, quantity, price, totalPrice, orderDateTime], (err, result) => {
        if (err) {
            console.error('Error placing order:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.status(201).json({ message: 'Order placed successfully!', orderID: result.insertId });
    });
});
app.post('/api/addClient', (req, res) => {
    const { companyName, phoneNumber, address } = req.body;

    // Ensure all fields are provided
    if (!companyName || !phoneNumber || !address) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Insert the new client into the CompanyOrders table
    const queryClient = 'INSERT INTO CompanyOrders (CompanyName, PhoneNo, Address, PaymentID, TotalAmount, RemainingAmount,OrderID) VALUES (?, ?, ?, ?, ?, ?,?)';
    
    // Assuming you want to insert some default values for TotalAmount and RemainingAmount
    const totalAmount = 0.00; // default value for TotalAmount
    const remainingAmount = 0.00; // default value for RemainingAmount
    const paymentID = 0; // assuming default value for PaymentID (this can be updated later)
    const OrderIDs = 0;
    connection.query(queryClient, [companyName, phoneNumber, address, paymentID, totalAmount, remainingAmount,OrderIDs], (err, result) => {
        if (err) {
            console.error('Error inserting client:', err);
            return res.status(500).json({ message: 'Failed to add client to CompanyOrders table', error: err });
        }

        // Send success response
        res.status(200).json({ message: 'Client added successfully' });
    });
});app.post('/api/placeOrder', (req, res) => {
  const { companyID, customerName, productID, quantity, price, paidAmount } = req.body;

  if (!companyID || !customerName || !productID || !quantity || !price || !paidAmount) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  connection.beginTransaction(err => {
      if (err) {
          console.error('Transaction error:', err);
          return res.status(500).json({ success: false, message: 'Transaction failed.' });
      }

      // ✅ Step 1: Fetch Company Details
      const getCompanyQuery = 'SELECT companyName, address, phoneNo FROM CompanyOrders WHERE companyOrderID = ?';
      connection.query(getCompanyQuery, [companyID], (err, companyResult) => {
          if (err) {
              return connection.rollback(() => {
                  console.error('Error fetching company details:', err);
                  res.status(500).json({ success: false, message: 'Failed to fetch company details.' });
              });
          }

          if (companyResult.length === 0) {
              return connection.rollback(() => {
                  res.status(404).json({ success: false, message: 'Company not found.' });
              });
          }

          const { companyName, address, phoneNo } = companyResult[0];

          // ✅ Step 2: Check available stock in Inventory
          const checkStockQuery = 'SELECT Remaining,pricepermeter FROM Inventory WHERE ProductID = ?';
          connection.query(checkStockQuery, [productID], (err, stockResult) => {
              if (err) {
                  return connection.rollback(() => {
                      console.error('Error checking stock:', err);
                      res.status(500).json({ success: false, message: 'Failed to check stock.' });
                  });
              }

              if (stockResult.length === 0) {
                  return connection.rollback(() => {
                      res.status(404).json({ success: false, message: 'Product not found in Inventory.' });
                  });
              }

              const remainingStock = Number(stockResult[0].Remaining); // Ensure it's a number
              const pricepermeter = Number(stockResult[0].pricepermeter);
              const requestedQuantity = Number(quantity);
              if (remainingStock < requestedQuantity) {
             
              return res.status(400).json({ success:false , message: 'Not enough stock available to place the order.' });
  
              
              }

              const totalBill = quantity * price;
              const income = (quantity * price) - (quantity * pricepermeter); // Income = Revenue - Cost

              // ✅ Step 5: Insert the order
              const insertOrderQuery = `
                INSERT INTO Orders (CompanyName, CustomerName, Product, Quantity, Price, DateTime, PayedAmount, TotalBill, Income, Address, PhoneNo)
                VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
              `;
      
              connection.query(insertOrderQuery, [companyName, customerName, productID, quantity, price, paidAmount, totalBill, income, address, phoneNo], (err, orderResult) => {
                if (err) {
                      return connection.rollback(() => {
                          console.error('Error inserting order:', err);
                          res.status(500).json({ success: false, message: 'Failed to place the order.' });
                      });
                  }

                  // ✅ Step 5: Update remaining stock
                  const updateStockQuery = 'UPDATE Inventory SET Remaining = Remaining - ? WHERE ProductID = ?';

                  connection.query(updateStockQuery, [quantity, productID], (err, stockUpdateResult) => {
                      if (err) {
                          return connection.rollback(() => {
                              console.error('Error updating stock:', err);
                              res.status(500).json({ success: false, message: 'Failed to update stock.' });
                          });
                      }

                      // ✅ Step 6: Commit the transaction
                      connection.commit(err => {
                          if (err) {
                              return connection.rollback(() => {
                                  console.error('Transaction commit error:', err);
                                  res.status(500).json({ success: false, message: 'Transaction commit failed.' });
                              });
                          }
                          const totalBill = quantity * price;

                          const updateCompanyOrdersQuery = `
            UPDATE CompanyOrders
            SET RemainingAmount = RemainingAmount+ ?,
            TotalAmount=TotalAmount+ ?
            WHERE CompanyName = ?
          `;
          connection.query(updateCompanyOrdersQuery, [ totalBill-paidAmount,totalBill, companyName], (updateCompanyOrdersErr, updateCompanyOrdersResult) => {
            if (updateCompanyOrdersErr) {
              console.error('Error updating company orders: ', updateCompanyOrdersErr);
              return res.status(500).json({ success: false, message: 'Failed to update company orders.' });
            }
            return res.status(201).json({ success: true, message: 'Order placed successfully!' });
             });
                    });
                  });
              });
          });
      });
  });
});


  app.get('/api/inventory', (req, res) => {
    const query = 'SELECT ProductID, ProductName FROM Inventory';
    db.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching inventory:', err);
        res.status(500).json({ error: 'Failed to fetch inventory products' });
      } else {
        res.json(results);
      }
    });
  });
  // Route to fetch data from companyorders table
app.get('/api/getCompanyOrders', (req, res) => {
    const query = 'SELECT CompanyName, Address, PhoneNo, RemainingAmount ,TotalAmount FROM CompanyOrders';
  
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching data:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
  
      // Send the results back to the frontend
      res.json({ success: true, data: results });
    });
  });
  app.get('/api/getPaymentHistory/:CompanyName', (req, res) => {
    const companyName = req.params.CompanyName;
  
    // Query to fetch the payment history for the given company ID
    const query = 'SELECT o.price,p.OrderID, p.AmountRemaining, p.DateTime, i.ProductName FROM  Payments p JOIN Orders o ON p.OrderID = o.OrderID JOIN Inventory i ON o.Product = i.ProductID WHERE  p.CompanyName = ?ORDER BY   p.DateTime DESC;';
    
    connection.query(query, [companyName], (err, results) => {
      if (err) {
        console.error('Error fetching payment history:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
  
      res.json({ success: true, data: results });
    });
  });
  app.post('/api/submitPayment', (req, res) => {
    const { orderID, paymentAmount } = req.body;
  
    // Validate the inputs
    if (!orderID || isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment details.' });
    }
  
    // Query to fetch the TotalBill and PayedAmount for the order
    const query = 'SELECT TotalBill, PayedAmount,companyName FROM Orders WHERE OrderID = ?';
    connection.query(query, [orderID], (err, result) => {
      if (err) {
        console.error('Database error: ', err);
        return res.status(500).json({ success: false, message: 'Database error.' });
      }
  
      if (result.length === 0) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
  
      const { TotalBill, PayedAmount,companyName } = result[0];
      
      // Remove the decimal from the existing PayedAmount
      let noDecimal2 = Math.trunc(PayedAmount);
      let newPayedAmount = noDecimal2 + paymentAmount;
  
      // Update the Orders table with the new PayedAmount
      const updateOrderQuery = `
        UPDATE Orders
        SET PayedAmount = ?
        WHERE OrderID = ?
      `;
      connection.query(updateOrderQuery, [newPayedAmount, orderID], (updateErr, updateResult) => {
        if (updateErr) {
          console.error('Error updating payment details: ', updateErr);
          return res.status(500).json({ success: false, message: 'Failed to update payment details.' });
        }
  
        // Now update the RemainingAmount in the CompanyOrders table
        // Fetch the current TotalAmount and RemainingAmount from CompanyOrders
        const companyQuery = 'SELECT paid, AmountRemaining FROM Payments WHERE OrderID = ?';
        connection.query(companyQuery, [orderID], (companyErr, companyResult) => {
          if (companyErr) {
            console.error('Error fetching company data: ', companyErr);
            return res.status(500).json({ success: false, message: 'Failed to fetch company details.' });
          }
  
          if (companyResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Company not found.' });
          }
  
          const { paid, AmountRemaining } = companyResult[0];
          let noDecimal1 = Math.trunc(paid);
          let noDecimal3 = Math.trunc(AmountRemaining);
          // Update the RemainingAmount for the company based on the payment
          let newRemainingAmount = noDecimal3-paymentAmount; // Adjust the remaining amount
          
          let newpaid=noDecimal1+paymentAmount;
          // Update the CompanyOrders table
          const updateCompanyQuery = `
            UPDATE Payments
            SET AmountRemaining = ?,
            paid=?
            WHERE OrderID = ?
          `;
          connection.query(updateCompanyQuery, [newRemainingAmount, newpaid,orderID], (updateCompanyErr, updateCompanyResult) => {
            if (updateCompanyErr) {
              console.error('Error updating company order: ', updateCompanyErr);
              return res.status(500).json({ success: false, message: 'Failed to update company order.' });
            }
            const updateCompanyOrdersQuery = `
            UPDATE CompanyOrders
            SET RemainingAmount = RemainingAmount - ?
            WHERE CompanyName = ?
          `;
          connection.query(updateCompanyOrdersQuery, [ paymentAmount, companyName], (updateCompanyOrdersErr, updateCompanyOrdersResult) => {
            if (updateCompanyOrdersErr) {
              console.error('Error updating company orders: ', updateCompanyOrdersErr);
              return res.status(500).json({ success: false, message: 'Failed to update company orders.' });
            }
  
            // Return a success response
            res.status(200).json({ success: true, message: 'Payment successfully processed.' });
          });
        });
        });
      });
    });
  });
  
  app.get('/api/getCompanyOrdersIncome', (req, res) => {
    const query = `
      SELECT 
        c.CompanyName, 
        c.Address, 
        c.PhoneNo, 
        IFNULL(SUM((o.PayedAmount /o.price )* (o.price - i.PricePerMeter)), 0) AS GeneratedIncome, 
        IFNULL(SUM(o.Income), 0) AS TotalIncome
      FROM 
        CompanyOrders c
      LEFT JOIN 
        Orders o ON c.CompanyName = o.CompanyName
      LEFT JOIN
        Inventory i ON o.Product = i.ProductID
      GROUP BY 
        c.CompanyName, c.Address, c.PhoneNo
    `;
  
    connection.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching data:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
  
      // Send the results back to the frontend
      res.json({ success: true, data: results });
    });
  });
  
  app.get('/api/getIncomeHistory/:CompanyName', (req, res) => {
    const companyName = req.params.CompanyName;
  
    // Query to fetch the payment history for the given company ID
    const query = 'SELECT o.OrderID, o.Product, o.PayedAmount, i.ProductName, o.DateTime, o.Income, ((o.PayedAmount /o.price )* (o.price - i.PricePerMeter)) AS ExtraPaid FROM Orders o JOIN  Inventory i ON o.Product = i.ProductID WHERE  o.CompanyName = ?ORDER BY  o.DateTime DESC;';
    
    connection.query(query, [companyName], (err, results) => {
      if (err) {
        console.error('Error fetching Income history:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }
  
      res.json({ success: true, data: results });
    });
  });
// Helper function to format the date range with time for DATETIME columns
function formatDateForDatetime(date) {
  return date + ' 00:00:00'; // Starting time for "from" date
}

function formatDateForDatetimeEnd(date) {
  return date + ' 23:59:59'; // Ending time for "to" date
}
app.post('/api/generateReport', (req, res) => {
  const { fromDate, toDate } = req.body;

  // Format the fromDate and toDate to include the time part
  const formattedFromDate = formatDateForDatetime(fromDate);
  const formattedToDate = formatDateForDatetimeEnd(toDate);
  
  // MySQL query to get total sales, income, and expenses in the given date range
  const query = `
    SELECT 
      (SELECT SUM(quantity) FROM Orders WHERE DateTime BETWEEN ? AND ?) AS totalSales,
      (select IFNULL(SUM((o.PayedAmount /o.price )* (o.price - i.PricePerMeter)), 0) FROM Orders o LEFT JOIN Inventory i ON o.Product = i.ProductID WHERE DateTime BETWEEN ? AND ?) AS totalIncome,
      (SELECT SUM(TotalAmount) FROM Expenses WHERE DateTime BETWEEN ? AND ?) AS totalExpenses
  `;

  // Execute the query
  connection.execute(query, [formattedFromDate, formattedToDate, formattedFromDate, formattedToDate, formattedFromDate, formattedToDate], (err, results) => {
    if (err) {
      console.error('Error fetching report data:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Calculate the profit and loss (simple logic)
    const totalSales = results[0].totalSales || 0;
    const totalIncome = results[0].totalIncome || 0;
    const totalExpenses = results[0].totalExpenses || 0;

    const profit = totalIncome - totalExpenses;
    const loss = profit < 0 ? Math.abs(profit) : 0;

    // Send the result back as a response
    const reportData = {
      totalSales: totalSales,
      totalIncome: totalIncome,
      totalExpenses: totalExpenses,
      profit: profit,
      loss: loss
    };

    res.json({ success: true, data: reportData });
  });
});
app.post('/api/returnPayment', (req, res) => {
  const { orderID, paymentAmount } = req.body;

  // Validate the inputs
  if (!orderID || isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid payment details.' });
  }

  // Query to fetch the TotalBill and PayedAmount for the order
  const query = 'SELECT price,product,companyName FROM Orders WHERE OrderID = ?';
  connection.query(query, [orderID], (err, result) => {
    if (err) {
      console.error('Database error: ', err);
      return res.status(500).json({ success: false, message: 'Database error.' });
    }

    

    const {price,productID,companyName }= result[0];
    let quantity=paymentAmount/price;
    const quantity1=quantity;
    
    

    // Update the Orders table with the new PayedAmount
    const updateinventoryQuery = `
      UPDATE Inventory
      SET Remaining = Remaining + ?
      WHERE productID = ?
    `;
    connection.query(updateinventoryQuery, [quantity1, productID], (updateErr, updateResult) => {
      if (updateErr) {
        console.error('Error updating payment details: ', updateErr);
        return res.status(500).json({ success: false, message: 'Failed to update payment details.' });
      }

      // Now update the RemainingAmount in the CompanyOrders table
      // Fetch the current TotalAmount and RemainingAmount from CompanyOrders
      const companyQuery = 'SELECT paid, AmountRemaining FROM Payments WHERE OrderID = ?';
      connection.query(companyQuery, [orderID], (companyErr, companyResult) => {
        if (companyErr) {
          console.error('Error fetching company data: ', companyErr);
          return res.status(500).json({ success: false, message: 'Failed to fetch company details.' });
        }

        if (companyResult.length === 0) {
          return res.status(404).json({ success: false, message: 'Company not found.' });
        }

        const { paid, AmountRemaining } = companyResult[0];
        let noDecimal1 = Math.trunc(paid);
        let noDecimal3 = Math.trunc(AmountRemaining);
        // Update the RemainingAmount for the company based on the payment
        let newRemainingAmount = noDecimal3-paymentAmount; // Adjust the remaining amount
        
        let newpaid=noDecimal1+paymentAmount;
        // Update the CompanyOrders table
        const updateCompanyQuery = `
          UPDATE Payments
          SET AmountRemaining = ?,
          paid=?
          WHERE OrderID = ?
        `;
        connection.query(updateCompanyQuery, [newRemainingAmount, newpaid,orderID], (updateCompanyErr, updateCompanyResult) => {
          if (updateCompanyErr) {
            console.error('Error updating company order: ', updateCompanyErr);
            return res.status(500).json({ success: false, message: 'Failed to update company order.' });
          }
          const updateCompanyOrdersQuery = `
          UPDATE CompanyOrders
          SET RemainingAmount = RemainingAmount - ?
          WHERE CompanyName = ?
        `;
        connection.query(updateCompanyOrdersQuery, [ paymentAmount, companyName], (updateCompanyOrdersErr, updateCompanyOrdersResult) => {
          if (updateCompanyOrdersErr) {
            console.error('Error updating company orders: ', updateCompanyOrdersErr);
            return res.status(500).json({ success: false, message: 'Failed to update company orders.' });
          }
          const updateOrdersquantityQuery = `
          UPDATE Orders
          SET quantity = quantity - ?,
          TotalBill=TotalBill - ?,
          Income=Income-?
          WHERE orderID = ?
        `;
        connection.query(updateOrdersquantityQuery, [ quantity1, paymentAmount,paymentAmount, orderID], (updateCompanyOrdersErr, updateCompanyOrdersResult) => {
          if (updateCompanyOrdersErr) {
            console.error('Error updating company orders: ', updateCompanyOrdersErr);
            return res.status(500).json({ success: false, message: 'Failed to update company orders.' });
          }

          // Return a success response
          res.status(200).json({ success: true, message: 'Payment successfully processed.' });
        });
      });
      });
      });
    });
  });
});