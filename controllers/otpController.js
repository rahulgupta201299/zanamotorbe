const axios = require('axios');
const OTP = require('../models/OTP');
const Profile = require('../models/Profile');

// Generate a random 6-digit OTP
const generateOTPCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate and send OTP
exports.generateOTP = async (req, res) => {
    try {
        const { isdCode, phoneNumber } = req.body;

        // Validate input
        if (!isdCode || !phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'ISD code and phone number are required'
            });
        }

        // Check if ISD code is 91 (India)
        if (isdCode !== '91') {
            return res.status(400).json({
                success: false,
                error: 'We do not support OTP generation outside India as of now. Please use an Indian phone number (ISD code: +91)'
            });
        }

        // Validate phone number format (10 digits for India)
        if (!/^\d{10}$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number. Please provide a valid 10-digit Indian phone number'
            });
        }

        // Generate OTP
        const otpCode = generateOTPCode();

        // Delete any existing OTPs for this phone number
        await OTP.deleteMany({ isdCode, phoneNumber });

        // Save OTP to database
        const otpRecord = await OTP.create({
            isdCode,
            phoneNumber,
            otp: otpCode
        });

        // Send OTP via Fast2SMS
        try {
            const apiKey = process.env.FAST2SMS_API_KEY;

            if (!apiKey) {
                console.error('FAST2SMS_API_KEY not configured in environment variables');
                return res.status(500).json({
                    success: false,
                    error: 'SMS service is not configured. Please contact administrator.'
                });
            }

            const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
                params: {
                    authorization: apiKey,
                    variables_values: otpCode,
                    route: 'otp',
                    numbers: phoneNumber
                }
            });

            if (response.data.return === false) {
                // Fast2SMS returned an error
                console.error('Fast2SMS Error:', response.data);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send OTP. Please try again later.'
                });
            }

            res.status(200).json({
                success: true,
                data: {
                    message: 'OTP sent successfully to +91-' + phoneNumber,
                    phoneNumber: `+${isdCode}-${phoneNumber}`,
                    expiresIn: '5 minutes'
                }
            });

        } catch (smsError) {
            console.error('Error sending SMS:', smsError.response?.data || smsError.message);

            // OTP is saved in DB but SMS failed - still return error
            await OTP.deleteOne({ _id: otpRecord._id });

            return res.status(500).json({
                success: false,
                error: 'Failed to send OTP via SMS. Please check your API configuration.'
            });
        }

    } catch (error) {
        console.error('Error in generateOTP:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while generating OTP'
        });
    }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { isdCode, phoneNumber, otp } = req.body;

        // Validate input
        if (!isdCode || !phoneNumber || !otp) {
            return res.status(400).json({
                success: false,
                error: 'ISD code, phone number, and OTP are required'
            });
        }

        // Check if ISD code is 91 (India)
        if (isdCode !== '91') {
            return res.status(400).json({
                success: false,
                error: 'We do not support OTP verification outside India as of now'
            });
        }

        // Find OTP record
        const otpRecord = await OTP.findOne({
            isdCode,
            phoneNumber,
            isVerified: false
        }).sort({ createdAt: -1 }); // Get the latest OTP

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                error: 'No OTP found or OTP has expired. Please request a new OTP'
            });
        }

        // Check if OTP matches
        if (otpRecord.otp !== otp) {
            return res.status(400).json({
                success: false,
                error: 'Invalid OTP. Please check and try again'
            });
        }

        // Mark OTP as verified
        otpRecord.isVerified = true;
        await otpRecord.save();

        // Check if profile exists with this isdCode and phoneNumber
        const existingProfile = await Profile.findOne({ isdCode, phoneNumber });

        if (existingProfile) {
            res.status(200).json({
                success: true,
                data: {
                    message: 'OTP verified successfully',
                    phoneNumber: `+${isdCode}-${phoneNumber}`,
                    verified: true,
                    profile: existingProfile
                }
            });
        } else {
            res.status(200).json({
                success: true,
                data: {
                    message: 'OTP verified successfully',
                    phoneNumber: `+${isdCode}-${phoneNumber}`,
                    verified: true
                }
            });
        }

    } catch (error) {
        console.error('Error in verifyOTP:', error);
        res.status(500).json({
            success: false,
            error: 'An error occurred while verifying OTP'
        });
    }
};
