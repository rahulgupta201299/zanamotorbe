const nodemailer = require('nodemailer');
const config = require('../config/config');

// Create email transporter
const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS
    }
});

/**
 * Send order confirmation email
 * @param {Object} order - Order details
 * @param {Object} customerEmail - Customer email address
 * @param {Object} customerName - Customer name (first name)
 */
const sendOrderConfirmationEmail = async (order, customerEmail, customerName) => {
    try {
        // Get customer names from shipping address
        const shipFirstName = order.shippingAddress?.fullName?.split(' ')[0] || customerName || 'Customer';
        const shipLastName = order.shippingAddress?.fullName?.split(' ').slice(1).join(' ') || '';

        const mailOptions = {
            from: config.EMAIL_FROM,
            to: customerEmail,
            subject: `Order Confirmed - ${order.orderNumber}`,
            html: `
                <p>Hey ${shipFirstName.charAt(0).toUpperCase() + shipFirstName.slice(1)} ${shipLastName.charAt(0).toUpperCase() + shipLastName.slice(1)},</p>
                <p>Greetings! Thank you for your recent order</p>
                <p>Your order is being processed and will be shipped out from our warehouse within 3-4 working days (excluding Saturday and Sunday)</p>
                <p>When it ships out, you will receive a tracking number using which you can track your shipment.</p>
                <p>Deliveries may take longer than usual due to unforeseen circumstances. We urge you to wait for your parcel.</p>
                
                <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Order Details</h3>
                    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                    <p><strong>Total Amount:</strong> ${order.currencySymbol || '₹'}${order.totalAmount.toLocaleString('en-IN')}</p>
                    <p><strong>Payment Method:</strong> ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
                    
                    <h4>Items Ordered:</h4>
                    ${order.items.map(item => `
                        <div style="border-bottom: 1px solid #ddd; padding: 5px 0;">
                            <p style="margin: 0;"><strong>${item.productName || 'Product'}</strong></p>
                            <p style="margin: 2px 0; font-size: 12px;">Qty: ${item.quantity} × ${order.currencySymbol || '₹'}${item.price.toLocaleString('en-IN')}</p>
                        </div>
                    `).join('')}
                </div>
                
                <p style="font-size:12px">1. Zana will not be responsible for shipping delays. Plan your purchase well in advance if you plan to buy a new motorcycle or have a ride coming up.</p>
                <p style="font-size:12px">2. Once the parcel leaves the Zana warehouse WE CAN NOT TRACK IT FOR YOU.</p>
                <p style="font-size:12px">3. The client is responsible for filling out the correct details like PIN CODE phone and email ID. Once the parcel leaves our premises we can not influence it. RTO CHARGES incurred thereof will be borne by the customer.</p>
                <p style="font-size:12px">4. Any RTO charges incurred by the customer are at the discretion of the shipping company. ZANA DOES NOT INFLUENCE SUCH A DECISION. We also urge the customer to take the call of your local delivery boys, a lot many companies NOW CALL BEFORE ATTEMPTING THE DROP. Not attending such calls may lead to RTO and will be responsibility of the client again.</p>
                <p>These are tough times for the shipping industry as they have lots of Govt imposed restrictions and also are Under staffed to cope up with HIGH online SHOPPING demand. We hope you will Understand their conditions and be mindful about it.</p>
                <p>We appreciate your patience.</p>
                <p>Welcome to the #Zana Family</p>
                <p>Ride Safe!</p>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Order confirmation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.log('Error sending order confirmation email:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send payment confirmation SMS
 * @param {Object} order - Order details
 * @param {string} phoneNumber - Customer phone number
 */
const sendPaymentConfirmationSMS = async (order, phoneNumber) => {
    try {
        console.log('sendPaymentConfirmationSMS')
        const client = require('twilio')(
            config.TWILIO_ACCOUNT_SID,
            config.TWILIO_AUTH_TOKEN
        );

        const message = `Thank you for your recent order ${order.orderNumber} on Zana Motorcycles of Amount ${Math.round(order.totalAmount)}. We will notify once the order is shipped.`;

        const twilioResponse = await client.messages.create({
            body: message,
            from: config.TWILIO_PHONE_NUMBER,
            to: phoneNumber
        });

        console.log('Payment confirmation SMS sent:', twilioResponse.sid);
        return { success: true, sid: twilioResponse.sid };
    } catch (error) {
        console.log('Error sending payment confirmation SMS:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendOrderConfirmationEmail,
    sendPaymentConfirmationSMS
};
