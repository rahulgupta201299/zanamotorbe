exports.getHealth = (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            status: 'OK',
            message: 'Zana Motors API is running',
            timestamp: new Date().toISOString()
        }
    });
};
