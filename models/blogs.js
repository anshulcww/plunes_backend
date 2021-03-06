const mongoose = require('mongoose')

const blogSchema = mongoose.Schema({
    title: {
        type: String,
        unique: true
    },
    tags: String,
    description: String,
    body: [String],
    uriTag: {
        type: String,
        unique: true
    },
    imageUrl: {
        type: String
    },
    author: {
        type: String
    },
    createdAt: {
        type: Date,
        default: new Date()
    }
})

blogSchema.statics.addPost = newPost => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await Blog.updateOne({ title: newPost.title }, {
                $set: {
                    ...newPost
                }
            }, { upsert: true })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

blogSchema.statics.editPost = (id, newPost) => {
    return new Promise(async (resolve, reject) => {
        newPost.body = newPost.body.split('\n')
        try {
            const result = await Blog.updateOne({ _id: mongoose.Types.ObjectId(id) }, {
                $set: {
                    ...newPost
                }
            })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

blogSchema.statics.getPost = id => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await Blog.findOne({ _id: mongoose.Types.ObjectId(id) })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

blogSchema.statics.getBlogPost = uriTag => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await Blog.findOne({ uriTag })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}


blogSchema.statics.deletePost = id => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await Blog.deleteOne({ _id: mongoose.Types.ObjectId(id) })
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

blogSchema.statics.getPostList = (skip) => {
    return new Promise(async (resolve, reject) => {
        try {
            let result = await Blog.find({}, '_id title createdAt uriTag description imageUrl').sort({ createdAt: -1 }).skip(skip*20).limit(20)
            resolve(result)
        } catch (e) {
            reject(e)
        }
    })
}

const Blog = mongoose.model('blogs', blogSchema)

module.exports = Blog