const jwt = require('jsonwebtoken')

const User = require('../models/user')
const Config = require('../config')

const auth = async (req, res, next) => {
    try {
        // console.log(req.baseUrl)
        const token = req.header('Authorization').replace('Bearer ', '')
        // console.log('Token:', token)
        const data = jwt.verify(token, Config.JWT_KEY)
        const user = await User.findOne({
            _id: data._id,
            'tokens.token': token
        })
        if (!user) {
            throw new Error({
                error: 'invalid user'
            })
        }
        req.user = user
        req.token = token
        next()
    } catch (error) {
        if (req.baseUrl == '/logout') {
            res.status(201).send({
                success: true
            })
        } else {
            res.status(401).send({
                error: 'not authorized'
            })
        }
    }
}

module.exports = auth