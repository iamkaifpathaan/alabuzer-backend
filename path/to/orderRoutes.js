// Fix orderRoutes.js, keeping only the order creation logic
const express = require('express');
const router = express.Router();

// Order creation route
router.post('/create-order', (req, res) => {
    // Your order creation logic here
});

module.exports = router;