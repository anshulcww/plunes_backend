const express = require('express')
const multer = require('multer')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')

const Blog = require('../models/blogs')

router = express.Router()

const auth = (req, res, next) => {
    const bearerHead = req.headers['authorization']
    if (typeof bearerHead !== undefined && bearerHead) {
        const token = bearerHead.split(' ')[1]
        jwt.verify(token, JWT_KEY, (err, authData) => {
            if (err) res.sendStatus(400)
            else {
                const data = authData
                if (data.user === "Admin") {
                    next()
                } else {
                    res.sendStatus(403)
                }
            }
        })
    } else {
        res.sendStatus(403)
    }
}

router.post('/addPost', async (req, res) => {
    console.log("Add post", req.body)
    try {
        req.body.uriTag = req.body.title.toLowerCase().replace(" ", '-').replace(/[^\w\s]/gi, '')
        let result = await Blog.addPost(req.body)
        console.log("New blog post added", req.body, result)
        res.status(200).send(result)
    } catch (e) {
        res.status(400).send(e)
    }
})

router.delete('/deletePost/:uriTag', async (req, res) => {
    try {
        let result = await Blog.deletePost(req.params.uriTag)
        console.log("Deleted post", req.params.uriTag, result)
        res.status(200).send(result)
    } catch (e) {
        res.status(400).send(e)
    }
})

router.get('/post/:uriTag', async (req, res) => {
    console.log("Get post", req.params.uriTag)
    try {
        let post = await Blog.getPost(req.params.uriTag)
        res.status(200).send(post)
    } catch (e) {
        res.status(400).send(e)
    }
})

router.get('/getPosts', async (req, res) => {
    console.log("Get posts")
    try {
        let post = await Blog.getPostList()
        res.status(200).send(post)
    } catch (e) {
        res.status(400).send(e)
    }
})

module.exports = router