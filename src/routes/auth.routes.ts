import { Router } from 'express';
import {
	changeAccountEmail,
	changeAccountPassword,
	login,
	logout,
	me,
	register,
	renameAccount
} from '../controllers/auth.controller.ts';
import { requireAuth } from '../middleware/auth.ts';

export const authRouter = Router();

authRouter.post('/auth/register', register);
authRouter.post('/auth/login', login);
authRouter.post('/auth/logout', logout);
authRouter.get('/auth/me', me);

authRouter.post('/auth/account/name', requireAuth, renameAccount);
authRouter.post('/auth/account/email', requireAuth, changeAccountEmail);
authRouter.post('/auth/account/password', requireAuth, changeAccountPassword);
