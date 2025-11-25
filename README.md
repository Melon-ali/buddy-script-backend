# Buddy – Social Networking Platform

## Project Overview

Buddy is a modern social networking web application designed for seamless user interaction. Users can create posts, comment, like/unlike content, chat in real-time, and recover their accounts via email-based password recovery. The system is built for scalability and real-time engagement with role-based access control.

---

- Client Side: [Buddy Script Client](https://buddy-script-client-rust.vercel.app)
- Server Side: [Buddy Script Server](https://buddy-script-backend-ebon.vercel.app)


## Technology Stack
The project leverages the following technologies:
- **Backend**: Node.js, TypeScript, Express.js, Prisma ORM
- **Database**: MongoDB
- **Real-TimeCommunication**: WebSocket
- **Authentication**: JSON Web Token (JWT)
- **Email Services**: Nodemailer / Mail Sender
- **Validation**: Zod
- **Hosting**: [Your hosting platform, e.g., Vercel, AWS, etc.]

---


## API Endpoints
### Auth Routes
- `POST /api/auth/login`  
  **Request**: `{ email, password }`  
  **Response**: `{ token, user }`
- `POST /api/auth/register`  
  **Request**: `{ username, email, password, role }`  
  **Response**: `{ message }`

### User Routes
- `GET /api/users/:id`  
  **Response**: `{ user }`
- `PUT /api/users/:id`  
  **Request**: `{ username, email }`  
  **Response**: `{ updatedUser }`

### Posts Routes
- `POST /api/posts`  
  **Request**: `{ content, image }`  
  **Response**: `{ message }`

### Posts Routes
- `POST /api/posts`  
  **Request**: `{ content, image }`  
  **Response**: `{ message }`

### Posts

`POST /api/posts` – `{Create a post}`

`GET /api/posts` – `{Fetch all posts}`

`GET /api/posts/:id` – `{Fetch a single post}`

`DELETE /api/posts/:id `– `{Delete a post}`

### Comments

`POST /api/comments` – `Add a comment to a post`

`GET /api/comments/:postId` – `Get comments for a post`

### Likes

`POST /api/posts/:id/like` –` Like a post`

`POST /api/posts/:id/unlike` –` Unlike a post`

### Chat

`WebSocket /ws – Real-time messaging endpoint`


---

## Database Schema



## API Endpoints  
 Here Is My Api Documentation: 

 https://documenter.getpostman.com/view/28428572/2sB3dJxrRz


## Admin Credentials  

  ## Live Hosting Link

  ### https://buddy-script-backend-ebon.vercel.app/api/v1


- **Gmail**: admin@gmail.com  
- **Password**: 123456789  

## Instructions to Run Locally  

1. **Clone the Repository**  
   ```bash  
   git clone https://github.com/Melon-ali/buddy-script-backend.git  
   cd projectname  

2. **set Env Based On .env.example file**

  ``` npm i
      npm run dev
      
      # buddy-script





## Table of Contents
- [Auth Routes](#auth-routes)


## Auth Routes
- **POST /auth/login**: Login a user
- **POST /auth/logout**: Logout a user
- **GET /auth/get-me**: Retrieve the profile of the logged-in user
- **PUT /auth/change-password**: Change the password of the logged-in user
- **POST /auth/forgot-password**: Initiate password reset process
- **POST /auth/reset-password**: Complete password reset process

## User Routes
- **POST /users**: Create a new user
- **POST /users/create-admin**: Create a new admin user
- **GET /users**: Retrieve all users
- **GET /users/:id**: Retrieve a single user by ID
- **PUT /users/:id**: Update a user by ID
- **DELETE /users/:id**: Delete a user by ID

### Database Schema

-- User: { id, username, email, password, role, profilePic, createdAt }

-- Post: { id, content, authorId, image, createdAt }

-- Comment: { id, postId, userId, content, createdAt }

-- Like: { id, postId, userId, createdAt }

-- ChatMessage: { id, senderId, receiverId, message, createdAt }

