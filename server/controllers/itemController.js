const Item = require('../models/Item');
const Notification = require('../models/Notification');
const User = require('../models/User');

let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
} catch (e) {
  // Cloudinary module optional fallback
}

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // Nodemailer optional fallback
}

// Helper to stream multer memoryStorage buffer to Cloudinary (with safe local fallback)
function uploadToCloudinary(fileBuffer, mimetype) {
  return new Promise((resolve) => {
    const hasCloudinaryKeys =
      cloudinary &&
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinaryKeys) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const stream = cloudinary.uploader.upload_stream(
        { folder: 'lokey_board_items', resource_type: 'image' },
        (error, result) => {
          if (error) {
            console.error('Cloudinary stream error, falling back to data URI:', error);
            const base64 = fileBuffer.toString('base64');
            return resolve(`data:${mimetype || 'image/jpeg'};base64,${base64}`);
          }
          resolve(result.secure_url || result.url);
        }
      );
      stream.end(fileBuffer);
    } else {
      const base64 = fileBuffer.toString('base64');
      resolve(`data:${mimetype || 'image/jpeg'};base64,${base64}`);
    }
  });
}

// Reusable email dispatch helper with detailed logging
async function sendNotificationEmail(toEmail, subject, htmlContent) {
  if (!nodemailer) {
    console.warn('[Email Skipped] nodemailer package is not installed.');
    return;
  }

  if (!toEmail || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      `[Email Skipped] Recipient or credentials missing. To: "${toEmail}", EMAIL_USER: "${process.env.EMAIL_USER ? 'Configured' : 'Missing'}", EMAIL_PASS: "${process.env.EMAIL_PASS ? 'Configured' : 'Missing'}"`
    );
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"LoKey Board" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent,
    });

    console.log(`[Email Delivered] To: ${toEmail} | MessageId: ${info.messageId}`);
  } catch (err) {
    console.error(`[Email Error Details] Failed sending to ${toEmail}:`, err.message);
  }
}

// --- High-Precision Matching Algorithm Helpers ---

const SYNONYMS = {
  specs: 'spectacles',
  spectacles: 'spectacles',
  glasses: 'spectacles',
  eyewear: 'spectacles',
  calc: 'calculator',
  bag: 'backpack',
  backpack: 'backpack',
  bottle: 'flask',
  flask: 'flask',
  mobile: 'phone',
  cellphone: 'phone',
  earphones: 'earbuds',
  earbuds: 'earbuds',
  airpods: 'earbuds',
};

function normalizeToken(token) {
  return SYNONYMS[token] || token;
}

function areTokensSimilar(a, b) {
  const normA = normalizeToken(a);
  const normB = normalizeToken(b);

  if (normA === normB) return true;

  // Prefix match: check the first 4 characters (e.g., "spec" matches "specs" and "spectacles")
  if (normA.length >= 4 && normB.length >= 4) {
    if (normA.slice(0, 4) === normB.slice(0, 4)) return true;
  }

  // Substring match for compound words/stems
  if (normA.length >= 4 && normB.includes(normA)) return true;
  if (normB.length >= 4 && normA.includes(normB)) return true;

  return false;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'near', 'by', 'of', 'and', 'or',
  'is', 'it', 'my', 'to', 'was', 'for', 'lost', 'found', 'item', 'with',
  'this', 'that', 'from', 'please', 'help', 'contact', 'there', 'has',
  'been', 'since', 'day', 'hour', 'last', 'looking', 'some', 'desk',
  'room', 'floor', 'bench', 'side', 'left', 'found',
]);

function extractTokens(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function calculateTokenOverlap(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;

  const setB = new Set(tokensB);
  let matchedA = 0;

  for (const a of tokensA) {
    if (setB.has(a)) {
      matchedA += 1;
    } else {
      const matchFound = tokensB.some((b) => areTokensSimilar(a, b));
      if (matchFound) matchedA += 0.85;
    }
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : Math.min(1, matchedA / union);
}

function scoreMatch(targetItem, candidate) {
  const targetTitleTokens = extractTokens(targetItem.title);
  const candTitleTokens = extractTokens(candidate.title);
  const titleSim = calculateTokenOverlap(targetTitleTokens, candTitleTokens);

  const targetDescTokens = extractTokens(targetItem.description);
  const candDescTokens = extractTokens(candidate.description);
  const descSim = calculateTokenOverlap(targetDescTokens, candDescTokens);

  const crossSim1 = calculateTokenOverlap(targetTitleTokens, candDescTokens);
  const crossSim2 = calculateTokenOverlap(candTitleTokens, targetDescTokens);
  const maxTitleSignal = Math.max(titleSim, crossSim1, crossSim2);

  // Guard against entirely disjoint items (e.g. laptop bag vs specs)
  if (maxTitleSignal < 0.2 && descSim < 0.2) {
    return 0;
  }

  let score = 0;

  // 1. Title relevance (Up to 45 pts)
  score += maxTitleSignal * 45;

  // 2. Description details (Up to 25 pts)
  score += descSim * 25;

  // 3. Category match bonus (15 pts)
  const targetCat = (targetItem.category || '').trim().toLowerCase();
  const candCat = (candidate.category || '').trim().toLowerCase();
  if (targetCat && candCat && targetCat === candCat) {
    score += 15;
  }

  // 4. Location similarity (Up to 8 pts)
  const targetLocTokens = extractTokens(targetItem.location);
  const candLocTokens = extractTokens(candidate.location);
  score += calculateTokenOverlap(targetLocTokens, candLocTokens) * 8;

  // 5. Date proximity (Up to 7 pts)
  if (targetItem.dateOccurred && candidate.dateOccurred) {
    const diffDays =
      Math.abs(new Date(targetItem.dateOccurred) - new Date(candidate.dateOccurred)) /
      (1000 * 60 * 60 * 24);

    if (diffDays <= 1) {
      score += 7;
    } else if (diffDays <= 3) {
      score += 4;
    } else if (diffDays <= 7) {
      score += 2;
    }
  }

  return Math.min(100, Math.round(score));
}

async function checkAndNotifyMatches(newItem) {
  try {
    const oppositeType = newItem.type === 'lost' ? 'found' : 'lost';

    const candidates = await Item.find({
      _id: { $ne: newItem._id },
      type: oppositeType,
      status: { $nin: ['handed_over', 'closed'] },
    })
      .populate('reportedBy', '_id name email')
      .lean();

    const matches = [];

    for (const candidate of candidates) {
      const matchScore = scoreMatch(newItem, candidate);
      if (matchScore >= 35) {
        matches.push({ candidate, matchScore });
      }
    }

    if (matches.length === 0) return;

    if (newItem.type === 'lost') {
      const topMatch = matches.sort((a, b) => b.matchScore - a.matchScore)[0];
      const matchText = matches.length === 1 ? '1 potential match' : `${matches.length} potential matches`;

      await Notification.create({
        recipient: newItem.reportedBy,
        sender: topMatch.candidate.reportedBy?._id || newItem.reportedBy,
        item: newItem._id,
        type: 'potential_match',
        message: `We found ${matchText} for your lost report "${newItem.title}".`,
      });
    } else if (newItem.type === 'found') {
      for (const { candidate } of matches) {
        if (!candidate.reportedBy?._id) continue;

        await Notification.create({
          recipient: candidate.reportedBy._id,
          sender: newItem.reportedBy,
          item: candidate._id,
          type: 'potential_match',
          message: `A newly found item "${newItem.title}" might match your lost report "${candidate.title}".`,
        });
      }
    }
  } catch (err) {
    console.error('Background matching notification error:', err);
  }
}

// --- Controller Handlers ---

async function createItem(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { type, title, description, category, location, dateOccurred, contactInfo, imageUrl } = req.body;

    const itemData = {
      type,
      title,
      description,
      category,
      location,
      dateOccurred,
      contactInfo,
      reportedBy: userId,
      imageUrl: imageUrl || null,
      status: 'active',
      claims: [],
    };

    if (req.file) {
      if (req.file.buffer) {
        itemData.imageUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
      } else {
        itemData.imageUrl = req.file.path || req.file.secure_url || req.file.url;
      }
    }

    const newItem = await Item.create(itemData);
    checkAndNotifyMatches(newItem);

    res.status(201).json(newItem);
  } catch (err) {
    console.error('createItem error:', err);
    res.status(400).json({ message: 'Failed to create item.', error: err.message });
  }
}

// Escape user input before using it inside a RegExp (e.g. searching "(" must not crash)
function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getItems(req, res) {
  try {
    const { type, category, location, date, search } = req.query;
    const filter = {};
    const andClauses = [];

    // 1. Type Filter (lost / found)
    if (type && type !== 'all') {
      filter.type = type.toLowerCase().trim();
    }

    // 2. Category Filter
    const STANDARD_CATEGORIES = ['Electronics', 'ID Card', 'Wallet', 'Jewellery', 'Personal Stuffs'];

    if (category && category !== 'all') {
      const cleanCategory = category.trim();
      if (cleanCategory.toLowerCase() === 'other') {
        andClauses.push({
          $or: [
            { category: { $regex: /^other$/i } },
            { category: { $nin: STANDARD_CATEGORIES.map((c) => new RegExp(`^${c}$`, 'i')) } },
          ],
        });
      } else {
        filter.category = { $regex: new RegExp(`^${escapeRegex(cleanCategory)}$`, 'i') };
      }
    }

    // 3. Location Filter
    if (location && location.trim()) {
      filter.location = { $regex: escapeRegex(location.trim()), $options: 'i' };
    }

    // 4. Date Filter
    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        const startOfDay = new Date(parsedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(parsedDate);
        endOfDay.setHours(23, 59, 59, 999);

        filter.dateOccurred = {
          $gte: startOfDay,$lte: endOfDay,
        };
      }
    }

    // 5. Keyword Search across Title & Description
    if (search && search.trim()) {
      const cleanSearch = escapeRegex(search.trim());
      andClauses.push({
        $or: [
          { title: { $regex: cleanSearch, $options: 'i' } },
          { description: { $regex: cleanSearch, $options: 'i' } },
        ],
      });
    }

    if (andClauses.length) {
      filter.$and = andClauses;
    }

    const items = await Item.find(filter)
      .populate('reportedBy', 'name email role phone')
      .populate('claims.claimant', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(items || []);
  } catch (err) {
    console.error('getItems query error:', err);
    res.status(500).json({ message: 'Failed to fetch items.', error: err.message });
  }
}

async function getMyItems(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const items = await Item.find({ reportedBy: userId })
      .populate('claims.claimant', 'name email phone role')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(items || []);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch your reports.', error: err.message });
  }
}

async function getMyClaims(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const claims = await Item.find({ 'claims.claimant': userId })
      .populate('reportedBy', 'name email phone role')
      .populate('claims.claimant', 'name email phone role')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(claims || []);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch claimed items.', error: err.message });
  }
}

async function getItemById(req, res) {
  try {
    const item = await Item.findById(req.params.id)
      .populate('reportedBy', 'name email phone role')
      .populate('claims.claimant', 'name email phone role');

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch item.', error: err.message });
  }
}

async function getPotentialMatches(req, res) {
  try {
    const targetItem = await Item.findById(req.params.id);
    if (!targetItem) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const targetType = (targetItem.type || '').toLowerCase();
    const oppositeType = targetType === 'lost' ? 'found' : 'lost';

    const candidates = await Item.find({
      _id: { $ne: targetItem._id },
      type: { $regex: new RegExp(`^${oppositeType}$`, 'i') },
      status: { $nin: ['handed_over', 'closed'] },
    })
      .populate('reportedBy', 'name email phone role')
      .lean();

    const scoredMatches = candidates
      .map((candidate) => ({
        ...candidate,
        matchScore: scoreMatch(targetItem, candidate),
      }))
      .filter((candidate) => candidate.matchScore >= 35)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    res.status(200).json({
      targetItem: {
        _id: targetItem._id,
        title: targetItem.title,
        type: targetItem.type,
      },
      count: scoredMatches.length,
      matches: scoredMatches,
      data: scoredMatches,
    });
  } catch (err) {
    console.error('Failed to fetch matches:', err);
    res.status(500).json({ message: 'Failed to fetch matches.', error: err.message });
  }
}

async function claimItem(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    const item = await Item.findById(req.params.id).populate('reportedBy', 'name email phone');
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (item.type !== 'found') {
      return res.status(400).json({ message: 'Only found items can be claimed.' });
    }

    const reportedById = item.reportedBy?._id
      ? item.reportedBy._id.toString()
      : item.reportedBy?.toString();

    if (reportedById === userId.toString()) {
      return res.status(400).json({ message: 'You cannot claim your own reported item.' });
    }

    if (item.status === 'handed_over' || item.status === 'closed') {
      return res.status(400).json({ message: 'This item has already been handed over.' });
    }

    if (!Array.isArray(item.claims)) {
      item.claims = [];
    }

    const existingClaim = item.claims.find((c) => {
      const cId = c.claimant?._id ? c.claimant._id.toString() : c.claimant?.toString();
      return cId === userId.toString() && c.status !== 'rejected';
    });

    if (existingClaim) {
      return res.status(400).json({ message: 'You have already submitted a claim on this item.' });
    }

    item.claims.push({
      claimant: userId,
      claimedAt: new Date(),
      status: 'pending',
      question: '',
      answer: '',
    });

    item.status = 'active';
    const updated = await item.save();

    const recipientId = item.reportedBy?._id || item.reportedBy;
    if (recipientId) {
      await Notification.create({
        recipient: recipientId,
        sender: userId,
        item: item._id,
        type: 'item_claimed',
        message: `${req.user?.name || 'A student'} submitted a claim on "${item.title}". Check your profile to send a verification question.`,
      });
    }

    if (item.reportedBy?.email) {
      sendNotificationEmail(
        item.reportedBy.email,
        `New Claim Request on "${item.title}"`,
        `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #23324a;">
            <h2>Someone submitted a claim on your report!</h2>
            <p>Hi <strong>${item.reportedBy.name || 'Campus Member'}</strong>,</p>
            <p><strong>${req.user?.name || 'A student'}</strong> (${req.user?.email || 'No email specified'}) has submitted a claim for your notice: <strong>"${item.title}"</strong>.</p>
            <div style="background: #f1ede4; border-left: 4px solid #2f6f5e; padding: 12px 16px; margin: 16px 0;">
              <p style="margin: 0; font-size: 14px;"><strong>Verification Question Challenge:</strong></p>
              <p style="margin: 4px 0 0; font-size: 13.5px;">Log in to your profile to send a secret challenge question or coordinate a meetup before handing over.</p>
            </div>
          </div>
        `
      );
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error('claimItem error:', err);
    res.status(500).json({ message: err.message || 'Failed to claim item.' });
  }
}

async function askVerificationQuestion(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { claimantId, question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Message or question cannot be empty.' });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const reportedById = item.reportedBy?._id
      ? item.reportedBy._id.toString()
      : item.reportedBy?.toString();

    if (reportedById !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to ask questions for this report.' });
    }

    if (!Array.isArray(item.claims)) {
      item.claims = [];
    }

    const claim = item.claims.find((c) => {
      const cId = c.claimant?._id ? c.claimant._id.toString() : c.claimant?.toString();
      return cId === claimantId.toString();
    });

    if (!claim) {
      return res.status(404).json({ message: 'Claimant not found on this item.' });
    }

    claim.question = question.trim();
    claim.answer = '';
    const updated = await item.save();

    await Notification.create({
      recipient: claimantId,
      sender: userId,
      item: item._id,
      type: 'item_claimed',
      message: `New message from founder regarding "${item.title}": "${question.trim()}". Check your profile to review/reply.`,
    });

    try {
      const claimantUser = await User.findById(claimantId).select('email name');
      if (claimantUser?.email) {
        sendNotificationEmail(
          claimantUser.email,
          `Verification Question on "${item.title}"`,
          `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #23324a;">
              <h3>New Verification Message from Founder</h3>
              <p>Hi <strong>${claimantUser.name || 'Campus Member'}</strong>,</p>
              <p>The founder of <strong>"${item.title}"</strong> has sent you a verification message or question:</p>
              <div style="background: #f1ede4; border-left: 4px solid #2f6f5e; padding: 12px 16px; margin: 16px 0;">
                "${question.trim()}"
              </div>
            </div>
          `
        );
      }
    } catch (emailErr) {
      console.error('Failed to lookup claimant email:', emailErr.message);
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error('askVerificationQuestion error:', err);
    res.status(500).json({ message: err.message || 'Failed to send question.' });
  }
}

async function answerVerificationQuestion(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { answer } = req.body;

    if (!answer || !answer.trim()) {
      return res.status(400).json({ message: 'Answer cannot be empty.' });
    }

    const item = await Item.findById(req.params.id).populate('reportedBy', 'name email');
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (!Array.isArray(item.claims)) {
      item.claims = [];
    }

    const claim = item.claims.find((c) => {
      const cId = c.claimant?._id ? c.claimant._id.toString() : c.claimant?.toString();
      return cId === userId.toString();
    });

    if (!claim) {
      return res.status(404).json({ message: 'You have not submitted an active claim on this item.' });
    }

    claim.answer = answer.trim();
    const updated = await item.save();

    const founderId = item.reportedBy?._id || item.reportedBy;

    await Notification.create({
      recipient: founderId,
      sender: userId,
      item: item._id,
      type: 'item_claimed',
      message: `${req.user?.name || 'A student'} answered your verification question for "${item.title}". Check your profile to review.`,
    });

    if (item.reportedBy?.email) {
      sendNotificationEmail(
        item.reportedBy.email,
        `Claimant replied to your question for "${item.title}"`,
        `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #23324a;">
            <h3>Claimant Answer Received</h3>
            <p>Hi <strong>${item.reportedBy.name || 'Campus Member'}</strong>,</p>
            <p><strong>${req.user?.name || 'The claimant'}</strong> has answered your question for <strong>"${item.title}"</strong>:</p>
            <div style="background: #f1ede4; border-left: 4px solid #2f6f5e; padding: 12px 16px; margin: 16px 0;">
              <strong>Reply:</strong> "${answer.trim()}"
            </div>
          </div>
        `
      );
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error('answerVerificationQuestion error:', err);
    res.status(500).json({ message: err.message || 'Failed to submit answer.' });
  }
}

async function verifyClaim(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { claimantId } = req.body;

    const item = await Item.findById(req.params.id)
      .populate('reportedBy', 'name email phone')
      .populate('claims.claimant', 'name email phone');

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const reportedById = item.reportedBy?._id
      ? item.reportedBy._id.toString()
      : item.reportedBy?.toString();

    if (reportedById !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to verify handover for this report.' });
    }

    const founderContact =
      item.contactInfo || item.reportedBy?.email || item.reportedBy?.phone || 'Campus Lost & Found Desk';

    item.status = 'handed_over';

    const otherPendingClaimants = [];

    if (Array.isArray(item.claims)) {
      item.claims.forEach((c) => {
        const cId = c.claimant?._id ? c.claimant._id.toString() : c.claimant?.toString();
        if (claimantId && cId === claimantId.toString()) {
          c.status = 'verified';
        } else if (c.status === 'pending') {
          c.status = 'rejected';
          otherPendingClaimants.push(c.claimant);
        }
      });
    }

    const updated = await item.save();

    if (claimantId) {
      await Notification.create({
        recipient: claimantId,
        sender: userId,
        item: item._id,
        type: 'item_claimed',
        message: `Handover confirmed! "${item.title}" has been handed over to you by ${item.reportedBy?.name || 'the founder'}.`,
      });
    }

    for (const claimant of otherPendingClaimants) {
      const recipientId = claimant?._id || claimant;
      if (recipientId) {
        await Notification.create({
          recipient: recipientId,
          sender: userId,
          item: item._id,
          type: 'item_claimed',
          message: `Your claim on "${item.title}" was rejected as the item has been handed over to its owner. For inquiries, contact: ${founderContact}`,
        });
      }
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error('verifyClaim error:', err);
    res.status(500).json({ message: err.message || 'Failed to verify handover.' });
  }
}

async function rejectClaim(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { claimantId } = req.body;

    const item = await Item.findById(req.params.id)
      .populate('reportedBy', 'name email phone');

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const reportedById = item.reportedBy?._id
      ? item.reportedBy._id.toString()
      : item.reportedBy?.toString();

    if (reportedById !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to manage this claim.' });
    }

    if (Array.isArray(item.claims)) {
      const targetClaim = item.claims.find(
        (c) => (c.claimant?._id ? c.claimant._id.toString() : c.claimant?.toString()) === claimantId?.toString()
      );
      if (targetClaim) {
        targetClaim.status = 'rejected';
      }
    }

    const updated = await item.save();

    const founderContact =
      item.contactInfo || item.reportedBy?.email || item.reportedBy?.phone || 'Campus Lost & Found Desk';

    if (claimantId) {
      await Notification.create({
        recipient: claimantId,
        sender: userId,
        item: item._id,
        type: 'item_claimed',
        message: `Your claim on "${item.title}" could not be verified by the founder. For inquiries, you can contact the founder at: ${founderContact}`,
      });
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error('rejectClaim error:', err);
    res.status(500).json({ message: err.message || 'Failed to reject claim.' });
  }
}

async function updateItem(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (item.reportedBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this report.' });
    }

    const { title, description, category, location, dateOccurred, contactInfo, status } = req.body;
    if (title) item.title = title;
    if (description !== undefined) item.description = description;
    if (category) item.category = category;
    if (location !== undefined) item.location = location;
    if (dateOccurred !== undefined) item.dateOccurred = dateOccurred;
    if (contactInfo !== undefined) item.contactInfo = contactInfo;
    if (status) item.status = status;

    if (req.file) {
      if (req.file.buffer) {
        item.imageUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
      } else {
        item.imageUrl = req.file.path || req.file.secure_url || req.file.url;
      }
    }

    const savedItem = await item.save();
    res.status(200).json(savedItem);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update item.', error: err.message });
  }
}

async function deleteItem(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (item.reportedBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this report.' });
    }

    await Item.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Item deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete item.', error: err.message });
  }
}

module.exports = {
  createItem,
  getItems,
  getMyItems,
  getMyClaims,
  getItemById,
  getPotentialMatches,
  claimItem,
  askVerificationQuestion,
  answerVerificationQuestion,
  verifyClaim,
  rejectClaim,
  updateItem,
  deleteItem,
};