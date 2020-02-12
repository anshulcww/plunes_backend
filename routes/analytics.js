const express = require('express')

const User = require('../models/user')

const router = express.Router()

router.get('/users', async (req, res) => {
    const users = await User.find({}).sort({
        _id: -1
    })
    var data = []
    users.forEach((u) => {
        u.tokens = undefined
        u.password = undefined
        data = data.concat({
            user: u,
            timestamp: u._id.getTimestamp()
        })
    })
    res.status(201).send({
        success: true,
        data: data
    })
})

module.exports = router