const twilio = require('twilio');
const config = require('../config/config');
const OTP = require('../models/OTP');
const Profile = require('../models/Profile');

// Helper function to generate a 6-digit OTP code
const generateOTPCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate and send OTP to user's phone number
exports.generateOTP = async (req, res) => {
    try {
        const { isdCode, phoneNumber } = req.body;

        // Validate required input parameters
        if (!isdCode || !phoneNumber) {
        return res.status(400).json({
            success: false,
            message: 'ISD code and phone number are required'
        });
        }

        // Generate a new 6-digit OTP code
        const otpCode = generateOTPCode();

        // Delete any existing unverified OTPs for this phone number to prevent duplicates
        await OTP.deleteMany({ isdCode, phoneNumber });

        // Create a new OTP record in the database
        const otpRecord = await OTP.create({
            isdCode,
            phoneNumber,
            otp: otpCode
        });

        try {
            const accountSid = config.TWILIO_ACCOUNT_SID;
            const authToken = config.TWILIO_AUTH_TOKEN;
            const twilioPhoneNumber = config.TWILIO_PHONE_NUMBER;

            // Check if Twilio credentials are properly configured
            if (!accountSid || !authToken || !twilioPhoneNumber) {
                console.log('Twilio credentials not configured in environment variables');
                return res.status(500).json({
                    success: false,
                    message: 'SMS service is not configured. Please contact administrator.'
                });
            }

            // Initialize Twilio client
            const client = twilio(accountSid, authToken);
            console.log({
                body: `Your OTP is: ${otpCode}`,
                from: `${twilioPhoneNumber}`,
                to: `${isdCode}${phoneNumber}`
            })
            // Send SMS with the OTP code
            const message = await client.messages.create({
                body: `Your OTP is: ${otpCode}`,
                from: twilioPhoneNumber,
                to: `${isdCode}${phoneNumber}`
            });
            console.log(`message: ${message}`)

            // Return success response
            res.status(200).json({
                success: true,
                data: {
                    message: `OTP sent successfully to ${isdCode}-${phoneNumber}`,
                    phoneNumber: `${isdCode}-${phoneNumber}`,
                    expiresIn: '5 minutes'
                }
            });

        } catch (smsError) {
            console.log(smsError)
            console.error('Error sending SMS:', smsError.message);

            // Clean up the OTP record if SMS sending failed
            await OTP.deleteOne({ _id: otpRecord._id });

            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP via SMS. Please check your API configuration.'
            });
        }

    } catch (error) {
        console.error('Error in generateOTP:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while generating OTP'
        });
    }
};

// Verify OTP entered by user
exports.verifyOTP = async (req, res) => {
    try {
        const { isdCode, phoneNumber, otp } = req.body;

        // Validate required input parameters
        if (!isdCode || !phoneNumber || !otp) {
        return res.status(400).json({
            success: false,
            message: 'ISD code, phone number, and OTP are required'
        });
        }

        // Find the most recent unverified OTP for this phone number
        const otpRecord = await OTP.findOne({
            isdCode,
            phoneNumber,
            isVerified: false
        }).sort({ createdAt: -1 });

        // Check if any OTP record exists
        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'No valid OTP found. OTP may have expired or was never sent. Please request a new OTP.'
            });
        }

        // Check if OTP has expired
        if (new Date() > otpRecord.expiresAt) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new OTP.'
            });
        }

        // Verify the OTP matches the stored code
        if (otpRecord.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please check and try again.'
            });
        }

        // Mark OTP as verified to prevent reuse
        otpRecord.isVerified = true;
        await otpRecord.save();

        // Check if user profile already exists for this phone number
        const existingProfile = await Profile.findOne({ isdCode, phoneNumber });

        // Return verification success with profile data if it exists
        if (existingProfile) {
            res.status(200).json({
                success: true,
                data: {
                    message: 'OTP verified successfully',
                    phoneNumber: `${isdCode}-${phoneNumber}`,
                    verified: true,
                    profile: existingProfile
                }
            });
        } else {
            // Return verification success without profile data
            res.status(200).json({
                success: true,
                data: {
                    message: 'OTP verified successfully',
                    phoneNumber: `${isdCode}-${phoneNumber}`,
                    verified: true
                }
            });
        }

    } catch (error) {
        console.error('Error in verifyOTP:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while verifying OTP'
        });
    }
};
