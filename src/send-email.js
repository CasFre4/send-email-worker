import { Resend } from 'resend';

import validator from 'validator';

// Advanced sanitization function
const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

// Advanced email validation with more options
const isValidEmail = (email) => {
  return validator.isEmail(email, {
    allow_display_name: false,
    require_tld: true,
    allow_utf8_local_part: false,
    allow_smtputf8: false
  });
};
function sanitizeInput(input, maxLength = 100) {
  // Return empty string if input is null, undefined, or not a string
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Trim whitespace and limit length
  let sanitized = input.trim().substring(0, maxLength);
  
  // HTML entity encoding for common XSS characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // Remove any remaining script tags (case insensitive)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove on* event handlers (onclick, onload, etc.)
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  return sanitized;
}
// Main validation and sanitization function
const ValidateAndSanitize = (name, email, message) => {
  // Validate presence
  if (!name || !email || !message) {
    return { error: 'All fields are required', status: 400 };
  }
  
  // Validate types
  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return { error: 'Invalid input format', status: 400 };
  }
  
  // Advanced email validation
  if (!isValidEmail(email)) {
    return { error: 'Invalid email address', status: 400 };
  }
  
  // Advanced sanitization
  const sanitizedName = sanitizeInput(name, 100);
  const sanitizedEmail = validator.normalizeEmail(email.trim());
  const sanitizedMessage = sanitizeInput(message, 2000);
  
  // Validate sanitized content
  if (!sanitizedName || sanitizedName.length < 2) {
    return { error: 'Name must be at least 2 characters', status: 400 };
  }
  
  if (!sanitizedMessage || sanitizedMessage.length < 4) {
    return { error: 'Message must be at least 10 characters', status: 400 };
  }
  
  // Check for spam patterns (basic)
  const spamPatterns = [
    /https?:\/\/[^\s]+/gi, // URLs
    /\b(buy now|click here|free money|urgent|act now)\b/gi, // Common spam words
    /(.)\1{4,}/g // Repeated characters (aaaaa, 11111)
  ];
  
  const hasSpam = spamPatterns.some(pattern => 
    pattern.test(sanitizedName) || pattern.test(sanitizedMessage)
  );
  
  if (hasSpam) {
    return { error: 'Message contains prohibited content', status: 400 };
  }
  
  // Return sanitized data if all validations pass
  return {
    sanitizedName,
    sanitizedEmail,
    sanitizedMessage
  };
};


async function onRequestPost (context) {
    console.log('start?')
    const {request, env } = context
    const resend = new Resend(env.RESEND_API_KEY)
    
    try {
        const {name, email, message} = await request.json();
        console.log('Arrived')
        const validation = ValidateAndSanitize(name, email, message) 
        console.log(validation)
        if (validation.error) {
            return new Response(JSON.stringify({ error: result.error }), {
                status: result.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        }
         const {sanitizedName ,sanitizedEmail, sanitizedMessage } = validation
        console.log('Arrived')
        await resend.emails.send({
            from: 'omar@omarspot.dev',
            to: 'ocasfre@gmail.com',
            subject: `Contact form submitted by ${sanitizedName}`,
            html: `
                <h3>Name: ${sanitizedName} Email: ${sanitizedEmail}</h3>
                <p><strong>Message:</strong>${sanitizedMessage}</p>

            `
        })
        return new Response(JSON.stringify({success: true}), {
                status: 200,
                headers: {'Content-Type': 'application/json', ...corsHeaders},
            })
    } catch(error) {
            console.error('Email send failed:', error);
            return new Response(JSON.stringify({ error: 'Failed to send email'}), {
                status: 500,
                headers: {'Content-Type': 'application/json', ...corsHeaders},
            })
        };
}
export default {
    async fetch(request, env, ctx) {
        console.log("I PUSH FINGERS INTO MY I's")
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: corsHeaders,
            });
        }
        let response
        const context = {request, env, ctx}
        if (request.method === 'POST') {
            response = await onRequestPost(context)
            // return onRequestPost(context)
        } else {
            response = new Response('Method not allowed', { status: 405, headers: corsHeaders });
            // return new Response('Method not allowed', { status: 405 });
        }

        // return new Response ('Method not allowed', {status: 405})
        return response
    }
}