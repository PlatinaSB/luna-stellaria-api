import { Router } from 'express';
import { classifyIndobert } from '../controllers/indobert.controller.ts';
import { requireAuth } from '../middleware/auth.ts';

export const indobertRouter = Router();

indobertRouter.post('/ai/indobert/classify', requireAuth, classifyIndobert);
