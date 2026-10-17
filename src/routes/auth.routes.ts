import { Router } from 'express';
import { login, logout, me, register } from '../controllers/auth.controller.ts';

export const authRouter = Router();

authRouter.post('/auth/register', register);
authRouter.post('/auth/login', login);
authRouter.post('/auth/logout', logout);
authRouter.get('/auth/me', me);
