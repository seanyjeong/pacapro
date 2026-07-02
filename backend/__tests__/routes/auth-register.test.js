jest.mock('../../config/database', () => ({
    getConnection: jest.fn(),
}));
jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
}));
jest.mock('../../utils/encryption', () => ({
    encrypt: jest.fn((value) => `enc:${value}`),
}));
jest.mock('../../utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
}));
jest.mock('../../services/adminSignupNotifier', () => ({
    notifySignupApprovalRequest: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { notifySignupApprovalRequest } = require('../../services/adminSignupNotifier');

function makeConnection() {
    return {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        query: jest.fn(),
        release: jest.fn(),
        rollback: jest.fn().mockResolvedValue(undefined),
    };
}

function makeApp() {
    const app = express();
    app.use(express.json());
    app.post('/paca/auth/register', require('../../routes/auth/registerHandler'));
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.hash.mockResolvedValue('hashed-password');
    notifySignupApprovalRequest.mockResolvedValue({ sent: true });
});

test('register creates pending owner academy and dispatches Telegram notification', async () => {
    const connection = makeConnection();
    db.getConnection.mockResolvedValue(connection);
    connection.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 77 }])
        .mockResolvedValueOnce([{ insertId: 12 }])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]);

    const res = await request(makeApp())
        .post('/paca/auth/register')
        .send({
            academyName: 'PACA 일산',
            email: 'owner@example.com',
            name: '김원장',
            password: 'password123',
            phone: '010-1111-2222',
            role: 'admin',
        });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
        message: 'Registration successful. Please wait for administrator approval.',
        user: {
            id: 77,
            email: 'owner@example.com',
            name: '김원장',
            role: 'owner',
            approvalStatus: 'pending',
        },
    });
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls[1][1]).toEqual([
        'owner@example.com',
        'hashed-password',
        'enc:김원장',
        'enc:010-1111-2222',
        'owner',
    ]);
    expect(notifySignupApprovalRequest).toHaveBeenCalledWith({
        academyId: 12,
        academyName: 'PACA 일산',
        email: 'owner@example.com',
        name: '김원장',
        phone: '010-1111-2222',
        userId: 77,
    });
});

test('duplicate email rolls back and does not notify', async () => {
    const connection = makeConnection();
    db.getConnection.mockResolvedValue(connection);
    connection.query.mockResolvedValueOnce([[{ id: 9 }]]);

    const res = await request(makeApp())
        .post('/paca/auth/register')
        .send({
            academyName: 'PACA 일산',
            email: 'owner@example.com',
            name: '김원장',
            password: 'password123',
        });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already registered');
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(notifySignupApprovalRequest).not.toHaveBeenCalled();
});

test('Telegram failure does not fail completed signup', async () => {
    const connection = makeConnection();
    db.getConnection.mockResolvedValue(connection);
    notifySignupApprovalRequest.mockRejectedValueOnce(new Error('telegram down'));
    connection.query
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 88 }])
        .mockResolvedValueOnce([{ insertId: 15 }])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]);

    const res = await request(makeApp())
        .post('/paca/auth/register')
        .send({
            academyName: 'PACA 강남',
            email: 'owner2@example.com',
            name: '박원장',
            password: 'password123',
        });

    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toBe(201);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(notifySignupApprovalRequest).toHaveBeenCalledTimes(1);
});

test('missing academy name returns Korean validation error before DB access', async () => {
    const res = await request(makeApp())
        .post('/paca/auth/register')
        .send({
            email: 'owner@example.com',
            name: '김원장',
            password: 'password123',
        });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
        error: 'Validation Error',
        message: '학원명을 입력해주세요.',
    });
    expect(db.getConnection).not.toHaveBeenCalled();
});
