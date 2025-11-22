export interface IPostServiceParams {
  userId: string;
  reqBody: any; // req.body
  files?: { [fieldname: string]: Express.Multer.File[] };
}

export interface IPostUpdateParams {
  postId: string;
  reqBody: any;
  files?: { [fieldname: string]: Express.Multer.File[] };
}

export interface IDeletePostParams {
  postId: string;
  userId: string; // logged-in user ID
}
