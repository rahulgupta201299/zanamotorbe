const twilio = require('twilio');
const axios = require('axios');
const config = require('../config/config');
const OTP = require('../models/OTP');
const Profile = require('../models/Profile');
const emailUtils = require('../utils/email');

// Helper function to generate a 6-digit OTP code
const generateOTPCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate and send OTP to user's phone number
exports.generateOTP = async (req, res) => {
    try {
        // otpMethod: 'sms' → go straight to Twilio (customer is not on WhatsApp)
        //            'whatsapp' or absent → try Interakt first, fall back to Twilio
        // NOTE: Interakt returns HTTP 201 + result:true for BOTH WhatsApp and
        // non-WhatsApp numbers — the delivery failure is only surfaced asynchronously
        // via webhook. There is no way to detect it synchronously from the send
        // response, so we rely on the client-supplied otpMethod preference.
        const { isdCode, phoneNumber, otpMethod } = req.body;

        // Validate required input parameters
        if (!isdCode || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'ISD code and phone number are required'
            });
        }

        const isBypassMode = config.BYPASS_OTP;

        // Generate a new 6-digit OTP code
        const otpCode = isBypassMode ? '123456' : generateOTPCode();

        // Delete any existing unverified OTPs for this phone number to prevent duplicates
        await OTP.deleteMany({ isdCode, phoneNumber });

        // Create a new OTP record in the database
        const otpRecord = await OTP.create({
            isdCode,
            phoneNumber,
            otp: otpCode
        });

        try {
            if (isBypassMode) {
                return res.status(200).json({
                    success: true,
                    data: {
                        message: `OTP sent successfully to ${isdCode}-${phoneNumber} (Bypassed)`,
                        phoneNumber: `${isdCode}-${phoneNumber}`,
                        expiresIn: '5 minutes',
                    },
                });
            }

            const accountSid = config.TWILIO_ACCOUNT_SID;
            const authToken = config.TWILIO_AUTH_TOKEN;
            const twilioPhoneNumber = config.TWILIO_PHONE_NUMBER;
            const interaktAPIUrl = config.INTERAKT_URL;
            const interaktApiKey = config.INTERAKT_API_KEY;

            // ── Customer explicitly chose SMS → skip WhatsApp entirely ──────────
            if (otpMethod === 'sms') {
                const client = twilio(accountSid, authToken);
                await client.messages.create({
                    body: `Your OTP is: ${otpCode}`,
                    from: twilioPhoneNumber,
                    to: `${isdCode}${phoneNumber}`,
                });

                otpRecord.deliveryMethod = 'sms';
                await otpRecord.save();

                return res.status(200).json({
                    success: true,
                    data: {
                        message: `OTP sent successfully to ${isdCode}-${phoneNumber}`,
                        phoneNumber: `${isdCode}-${phoneNumber}`,
                        expiresIn: '5 minutes',
                    },
                });
            }

            // ── WhatsApp preference or no preference: try Interakt, fall back ──
            let sentViaWhatsapp = false;
            let whatsappFailed = false;

            if (interaktApiKey) {
                try {
                    const countryCode = isdCode.replace('+', '');
                    const interaktPayload = {
                        countryCode: countryCode,
                        phoneNumber: phoneNumber,
                        type: 'Template',
                        template: {
                            name: config.INTERAKT_OTP_TEMPLATE_NAME,
                            languageCode: 'en',
                            bodyValues: [otpCode],
                            buttonValues: {
                                0: [otpCode],
                            },
                        },
                    };

                    const response = await axios.post(interaktAPIUrl, interaktPayload, {
                        headers: { Authorization: `Basic ${interaktApiKey}`, 'Content-Type': 'application/json' }
                    });
                    console.log('Interakt OTP response:', JSON.stringify(response.data));

                    if (response.data && response.data.result !== false) {
                        sentViaWhatsapp = true;
                        otpRecord.deliveryMethod = 'whatsapp';
                        if (response.data.id) {
                            otpRecord.interaktMessageId = response.data.id;
                        }
                        await otpRecord.save();
                    } else {
                        whatsappFailed = true;
                    }
                } catch (waError) {
                    console.log('Error sending WhatsApp OTP via Interakt:', waError.response ? waError.response.data : waError.message);
                    whatsappFailed = true;
                }
            } else {
                whatsappFailed = true;
            }

            if (!sentViaWhatsapp && whatsappFailed) {
                const client = twilio(accountSid, authToken);
                await client.messages.create({
                    body: `Your OTP is: ${otpCode}`,
                    from: twilioPhoneNumber,
                    to: `${isdCode}${phoneNumber}`,
                });

                otpRecord.deliveryMethod = 'sms';
                await otpRecord.save();
            }

            res.status(200).json({
                success: true,
                data: {
                    message: `OTP sent successfully to ${isdCode}-${phoneNumber}`,
                    phoneNumber: `${isdCode}-${phoneNumber}`,
                    expiresIn: '5 minutes',
                },
            });

        } catch (smsError) {
            console.log('Error sending OTP:', smsError.message);

            // Clean up the OTP record if sending failed
            await OTP.deleteOne({ _id: otpRecord._id });

            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP via SMS or WhatsApp. Please check your API configuration.'
            });
        }

    } catch (error) {
        console.log('Error in generateOTP:', error);
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

        const isBypassMode = config.BYPASS_OTP;
        const isBypassValid = isBypassMode && (otp === '123456');

        if (!isBypassValid) {
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
        }

        // Mark OTP as verified to prevent reuse
        if (otpRecord) {
            otpRecord.isVerified = true;
            await otpRecord.save();
        }

        const actualOtpMethod = otpRecord ? (otpRecord.deliveryMethod || 'sms') : 'sms';

        // Check if user profile already exists for this phone number
        const existingProfile = await Profile.findOne({
            isdCode,
            $or: [
                { phoneNumber: `${isdCode}-${phoneNumber}` },
                { phoneNumber: phoneNumber }
            ]
        });

        // Return verification success with profile data if it exists
        if (existingProfile) {
            res.status(200).json({
                success: true,
                data: {
                    message: 'OTP verified successfully',
                    phoneNumber: `${isdCode}-${phoneNumber}`,
                    otpMethod: actualOtpMethod,
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
                    otpMethod: actualOtpMethod,
                    verified: true
                }
            });
        }

    } catch (error) {
        console.log('Error in verifyOTP:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while verifying OTP'
        });
    }
};
// Generate and send OTP to user's email address
exports.generateEmailOTP = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate required input parameters
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const isBypassMode = config.BYPASS_OTP;

        // Generate a new 6-digit OTP code
        const otpCode = isBypassMode ? '123456' : generateOTPCode();

        // Delete any existing unverified OTPs for this email to prevent duplicates
        await OTP.deleteMany({ email });

        // Create a new OTP record in the database
        const otpRecord = await OTP.create({
            email,
            otp: otpCode
        });

        // Send OTP via email
        let emailResult = { success: true };
        if (!isBypassMode) {
            emailResult = await emailUtils.sendEmailOTP(email, otpCode);
        }

        if (emailResult.success) {
            res.status(200).json({
                success: true,
                data: {
                    message: `OTP sent successfully to ${email}${isBypassMode ? ' (Bypassed)' : ''}`,
                    email: email,
                    expiresIn: '5 minutes'
                }
            });
        } else {
            // Clean up the OTP record if email sending failed
            await OTP.deleteOne({ _id: otpRecord._id });

            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP via email. Please check your configuration.'
            });
        }

    } catch (error) {
        console.log('Error in generateEmailOTP:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while generating email OTP'
        });
    }
};

// Verify email OTP entered by user
exports.verifyEmailOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Validate required input parameters
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        // Find the most recent unverified OTP for this email
        const otpRecord = await OTP.findOne({
            email,
            isVerified: false
        }).sort({ createdAt: -1 });

        const isBypassMode = config.BYPASS_OTP;
        const isBypassValid = isBypassMode && (otp === '123456');

        if (!isBypassValid) {
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
        }

        // Mark OTP as verified to prevent reuse
        if (otpRecord) {
            otpRecord.isVerified = true;
            await otpRecord.save();
        }

        // Check if user profile already exists for this email
        const existingProfile = await Profile.findOne({ emailId: email });

        // Return verification success with profile data if it exists
        if (existingProfile) {
            res.status(200).json({
                success: true,
                data: {
                    message: 'Email OTP verified successfully',
                    email: email,
                    verified: true,
                    profile: existingProfile
                }
            });
        } else {
            // Return verification success without profile data
            res.status(200).json({
                success: true,
                data: {
                    message: 'Email OTP verified successfully',
                    email: email,
                    verified: true
                }
            });
        }

    } catch (error) {
        console.log('Error in verifyEmailOTP:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while verifying email OTP'
        });
    }
};

// Generate and send OTP to admin's email address
exports.generateAdminEmailOTP = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate required input parameters
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Check if email exists in the admin emails list
        const adminEmails = config.ADMIN_EMAILS || [];
        if (!adminEmails.includes(email)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Email is not an admin email'
            });
        }

        const isBypassMode = config.BYPASS_OTP;

        // Generate a new 6-digit OTP code
        const otpCode = isBypassMode ? '123456' : generateOTPCode();

        // Delete any existing unverified OTPs for this email to prevent duplicates
        await OTP.deleteMany({ email });

        // Create a new OTP record in the database
        const otpRecord = await OTP.create({
            email,
            otp: otpCode
        });

        // Send OTP via email
        let emailResult = { success: true };
        if (!isBypassMode) {
            emailResult = await emailUtils.sendEmailOTP(email, otpCode);
        }

        if (emailResult.success) {
            res.status(200).json({
                success: true,
                data: {
                    message: `OTP sent successfully to ${email}${isBypassMode ? ' (Bypassed)' : ''}`,
                    email: email,
                    expiresIn: '5 minutes'
                }
            });
        } else {
            // Clean up the OTP record if email sending failed
            await OTP.deleteOne({ _id: otpRecord._id });

            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP via email. Please check your configuration.'
            });
        }

    } catch (error) {
        console.log('Error in generateAdminEmailOTP:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while generating admin email OTP'
        });
    }
};

// Verify admin email OTP entered by user
exports.verifyAdminEmailOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Validate required input parameters
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        // Check if email exists in the admin emails list
        const adminEmails = config.ADMIN_EMAILS || [];
        if (!adminEmails.includes(email)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Email is not an admin email'
            });
        }

        // Find the most recent unverified OTP for this email
        const otpRecord = await OTP.findOne({
            email,
            isVerified: false
        }).sort({ createdAt: -1 });

        const isBypassMode = config.BYPASS_OTP;
        const isBypassValid = isBypassMode && (otp === '123456');

        if (!isBypassValid) {
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
        }

        // Mark OTP as verified to prevent reuse
        if (otpRecord) {
            otpRecord.isVerified = true;
            await otpRecord.save();
        }

        // Return verification success without profile data check for admin
        res.status(200).json({
            success: true,
            data: {
                message: 'Admin Email OTP verified successfully',
                email: email,
                verified: true
            }
        });

    } catch (error) {
        console.log('Error in verifyAdminEmailOTP:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while verifying admin email OTP'
        });
    }
};

// Handle incoming Interakt webhooks (specifically message_api_failed for SMS fallback)
exports.handleInteraktWebhook = async (req, res) => {
    try {
        // Return 200 OK immediately to satisfy Interakt's 3-second timeout requirement
        res.status(200).json({ success: true });

        const signature = req.headers['interakt-signature'];
        const secret = config.INTERAKT_WEBHOOK_SECRET;

        // Verify HMAC signature if secret is configured
        if (secret && signature) {
            const crypto = require('crypto');
            const cleanSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;
            const expectedSignature = crypto
                .createHmac('sha256', secret)
                .update(JSON.stringify(req.body))
                .digest('hex');

            if (cleanSignature !== expectedSignature) {
                console.log('Interakt webhook signature mismatch');
                return;
            }
        }

        const { type, data } = req.body || {};
        if (type !== 'message_api_failed' || !data || !data.message) {
            return;
        }

        const messageId = data.message.id;
        if (!messageId) {
            return;
        }

        console.log(`Received message_api_failed webhook from Interakt for message ID: ${messageId}`);

        // Find active, unverified, un-fallback-sent OTP record matching messageId
        const otpRecord = await OTP.findOne({
            interaktMessageId: messageId,
            isVerified: false,
            smsFallbackSent: false
        });

        if (!otpRecord) {
            console.log(`No active unverified OTP record found for Interakt message ID: ${messageId}`);
            return;
        }

        // Check if OTP has expired
        if (new Date() > otpRecord.expiresAt) {
            console.log(`OTP for Interakt message ID: ${messageId} has expired. Skipping SMS fallback.`);
            return;
        }

        // Fall back to Twilio SMS
        const accountSid = config.TWILIO_ACCOUNT_SID;
        const authToken = config.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = config.TWILIO_PHONE_NUMBER;

        if (accountSid && authToken && twilioPhoneNumber) {
            const client = twilio(accountSid, authToken);
            await client.messages.create({
                body: `Your OTP is: ${otpRecord.otp}`,
                from: twilioPhoneNumber,
                to: `${otpRecord.isdCode}${otpRecord.phoneNumber}`,
            });

            otpRecord.smsFallbackSent = true;
            otpRecord.deliveryMethod = 'sms';
            await otpRecord.save();

            console.log(`SMS fallback sent successfully via Twilio for OTP to ${otpRecord.isdCode}-${otpRecord.phoneNumber}`);
        } else {
            console.log('Twilio configuration missing. Cannot send SMS fallback.');
        }

    } catch (error) {
        console.log('Error handling Interakt webhook:', error.message);
    }
};
