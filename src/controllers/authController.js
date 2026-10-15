import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config/env.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logAuditEvent } from '../services/auditService.js';

export async function login(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) {
      return errorResponse(res, 'Login code is required', 400);
    }

    const trimmedCode = code.trim();
    const user = await User.findOne({ code: trimmedCode });

    if (!user || user.isRemoved) {
      return errorResponse(res, 'Invalid code. Access denied.', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'User account is inactive. Please contact administrator.', 403);
    }

    const token = jwt.sign(
      {
        userId: user._id,
        code: user.code,
        role: user.role,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    await logAuditEvent({
      userId: user._id,
      userCode: user.code,
      role: user.role,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user._id.toString(),
      description: `User ${user.name} (${user.role}) logged in successfully with code ${user.code}`,
      ipAddress: req.ip,
    });

    return successResponse(res, {
      token,
      user: {
        id: user._id,
        code: user.code,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    }, 200, 'Login successful');
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.user) {
      await logAuditEvent({
        userId: req.user._id,
        userCode: req.user.code,
        role: req.user.role,
        action: 'LOGOUT',
        entity: 'USER',
        entityId: req.user._id.toString(),
        description: `User ${req.user.name} logged out`,
        ipAddress: req.ip,
      });
    }
    return successResponse(res, null, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    return successResponse(res, {
      user: {
        id: req.user._id,
        code: req.user.code,
        name: req.user.name,
        role: req.user.role,
        permissions: req.user.permissions,
      },
    });
  } catch (error) {
    next(error);
  }
}
