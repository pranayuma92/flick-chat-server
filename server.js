const express = require('express')
const socketio = require('socket.io')
const http = require('http')
const mongoose = require('mongoose')
const cors = require('cors')

const { addUser, removeUser, getUser, getUsersInRoom, getUsersCount } = require('./users')
const { User } = require('./models')

const PORT = process.env.PORT || 5000

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const uri = 'mongodb+srv://pranayuma92:pandu123@cluster0-ljlc0.gcp.mongodb.net/test?retryWrites=true&w=majority'
mongoose.connect(uri, { useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true }, () => {
	console.log('Mongodb database connection established succesfully')
})

io.on('connection', (socket) => {
	console.log('User join')

	socket.on('join', ({ name, room }, callback ) => {
		const { error, user } = addUser({id : socket.id, name, room})

		if(error) return callback(error)

		User.exists({ username: user.name }, (err, res) => {

			if(res) return false

			const newUser = new User({ username: user.name })
			newUser.save()
			 .then(() => console.log('User added'))
			 .catch(err => console.log('Error: ' + err))
		})

		socket.emit('message', { user: 'system' , text: `hi ${user.name}, welcome to the room ${user.room}`})
		socket.emit('updateData', { count: getUsersInRoom(room) })
		socket.broadcast.to(user.room).emit('updateData', { count: getUsersInRoom(room) })
		socket.broadcast.to(user.room).emit('message', { user: 'system' , text: `${user.name}, has joined!`})

		socket.join(user.room)
		callback()
	})

	socket.on('sendMessage', (message, callback) => {
		const user = getUser(socket.id)

		io.to(user.room).emit('message', { user: user.name, text: message })
		callback()
	})

	socket.on('typing', ({ typing }) => {
		const user = getUser(socket.id)

		if(typing){
			socket.broadcast.to(user.room).emit('display', {typing : typing, name: user.name})
		}
	})

	socket.on('leftRoom', () => {
		console.log('user left')
		const user = removeUser(socket.id)

		if(user){
			io.to(user.room).emit('message', { user: 'system' , text: `${user.name}, has left!`})
			io.to(user.room).emit('updateData', { count: getUsersInRoom(user.room) })
		}
	})

	socket.on('disconnect', () => {
		console.log('user left')
		const user = removeUser(socket.id)

		if(user){
			io.to(user.room).emit('message', { user: 'system' , text: `${user.name}, has left!`})
			io.to(user.room).emit('updateData', { count: getUsersInRoom(user.room) })
		}
	})
})

app.get('/', (req, res) => {
	res.send('Server is running')
})

app.use(cors())

server.listen(PORT, () => console.log('Server running on port: ', PORT))