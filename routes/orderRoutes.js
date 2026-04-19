// Import express and create a router
const express = require('express');
const router = express.Router();

// Import the controller
const orderController = require('../controllers/orderController');

// Define the routes
router.get('/', orderController.getAllOrders);
router.post('/', orderController.createOrder);
router.get('/:id', orderController.getOrderById);
router.put('/:id', orderController.updateOrder);
router.delete('/:id', orderController.deleteOrder);

// Export the router
module.exports = router;
