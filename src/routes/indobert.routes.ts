import { Router } from 'express';
import { classifyIndobert } from '../controllers/indobert.controller.ts';
import { requireAuth } from '../middleware/auth.ts';
import { requireTurnstile } from '../middleware/turnstile.ts';

export const indobertRouter = Router();

indobertRouter.post('/ai/indobert/classify', requireAuth, requireTurnstile, classifyIndobert);
