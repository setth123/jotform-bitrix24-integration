const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits with optional leading "+", spaces, dots, dashes and parentheses; 8-15 digits in total.
const PHONE_REGEX = /^\+?[\d\s().-]+$/;

/**
 * Validates and normalizes the contact extracted from a Jotform submission.
 * @param {{ fullName: string, phone: string, email: string }} contact
 * @returns {{ errors: string[], contact: { fullName: string, phone: string, email: string } }}
 */
function validateContact(contact) {
  const fullName = (contact.fullName || '').trim();
  const phone = (contact.phone || '').trim();
  const email = (contact.email || '').trim().toLowerCase();
  const errors = [];

  if (!fullName) errors.push('Full name is required');

  const digitCount = phone.replace(/\D/g, '').length;
  if (!phone) errors.push('Phone number is required');
  else if (!PHONE_REGEX.test(phone) || digitCount < 8 || digitCount > 15) {
    errors.push(`Invalid phone number: "${phone}"`);
  }

  if (!email) errors.push('Email is required');
  else if (!EMAIL_REGEX.test(email)) errors.push(`Invalid email: "${email}"`);

  return { errors, contact: { fullName, phone, email } };
}

module.exports = { validateContact };
