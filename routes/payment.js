const express = require('express')
const mongoose = require('mongoose')

const Config = require('../config')
const User = require('../models/user')
const Booking = require('../models/booking')
const Solution = require('../models/solution')
const Notification = require('../models/notification')
const Catalogue = require('../models/catalogue')

const router = express.Router()

router.post('/' , auth, async (req, res) => {

})


module.exports = router