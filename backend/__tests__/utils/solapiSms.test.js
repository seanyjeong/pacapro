jest.mock('axios', () => ({ post: jest.fn() }));
const axios = require('axios');
const { sendSMSSolapi } = require('../../utils/solapi');
const settings = { solapi_api_key: 'synthetic-key', solapi_api_secret: 'synthetic-secret', solapi_sender_phone: '010-0000-0001' };
beforeEach(() => axios.post.mockReset());

test('over 90 bytes becomes LMS, and the first message id is returned', async () => {
  axios.post.mockResolvedValue({ data: { messageList: [{ messageId: 'M-1' }], failedMessageList: [] } });
  const short = await sendSMSSolapi(settings, [{ phone: '010-9000-0060' }], '인증번호 123456');
  expect(short).toMatchObject({ success: true, messageType: 'SMS', messageId: 'M-1', failedCount: 0 });
  const long = await sendSMSSolapi(settings, [{ phone: '01090000060' }], '가'.repeat(31));
  expect(long.messageType).toBe('LMS');
  expect(axios.post.mock.calls[1][1].messages).toEqual([{ to: '01090000060', from: '01000000001', text: '가'.repeat(31), type: 'LMS' }]);
});

test('a 200 answer with rejected messages reports failedCount', async () => {
  axios.post.mockResolvedValue({ data: { messageList: [], failedMessageList: [{ statusCode: '1062' }] } });
  expect(await sendSMSSolapi(settings, [{ phone: '01090000060' }], '합성')).toMatchObject({ success: true, failedCount: 1 });
});
