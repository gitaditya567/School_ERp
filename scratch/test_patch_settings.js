import axios from 'axios';

async function main() {
  try {
    // First login as admin
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@prideandjoy.in',
      password: 'AdminPassword123!'
    });
    
    const token = loginRes.data.token;
    console.log('Login success! Token acquired.');

    // Get current settings
    const getRes = await axios.get('http://localhost:5000/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Current Settings:', getRes.data.school);

    // Try PATCH settings with numerical strings vs numbers
    const patchBody = {
      ...getRes.data.school,
      name: 'Sardaar Patel School',
      branch: 'NA',
      phone: '232323232',
      email: 'olavel567@gmail.com',
      payeeName: '345345435',
      session: '2026-27',
      receiptPrefix: 'SP/26/',
      feeWindow: '1st–10th of month',
      lateFeeFrom: '20',
      lateFeeAmount: '100',
      readmissionCharge: '100',
      advanceConcession: '2000'
    };

    const patchRes = await axios.patch('http://localhost:5000/api/settings', patchBody, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('PATCH Response:', patchRes.data);

  } catch (err) {
    console.error('Error status:', err.response?.status);
    console.error('Error data:', err.response?.data);
    console.error('Error message:', err.message);
  }
}

main();
