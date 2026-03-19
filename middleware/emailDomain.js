export function requireBabcockEmail(req, res, next) {
  const { email } = req.body;
  if (!email || !email.toLowerCase().endsWith('@babcock.edu.ng')) {
    return res.status(400).json({ message: 'Only @babcock.edu.ng email addresses are allowed' });
  }
  next();
}
