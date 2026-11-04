update public.platform_content
set
  content = replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(content,
                      '3.4. Two-factor authentication with an authenticator app is required for staff and administrator accounts, and is available on request for any account.',
                      '3.4. Two-factor authentication with an authenticator app is required for staff and administrator accounts, and is available on request for any account.' || chr(10) ||
                      '3.5. Corporate accounts may be opened only by an authorized representative of the named organization. The person registering confirms that they have authority to submit the organization''s information, accept these Terms, and instruct ITUKARUA KENYA to provide corporate services.'),
                    '6. YOUR CONTENT',
                    '6. CORPORATE ACCOUNT VERIFICATION AND PAYMENT' || chr(10) ||
                    '6.1. A corporate applicant must provide an organization name, a login email, and any contact or billing details requested during signup. We send a one-time verification code to the login email before the account can proceed to payment.' || chr(10) ||
                    '6.2. Verification confirms control of the submitted email address; it does not by itself prove incorporation, licensing, ownership, or authority. ITUKARUA KENYA may request additional organization or representative documents before activating or continuing a corporate placement.' || chr(10) ||
                    '6.3. Corporate plans and custom placements are quoted or priced according to the selected tier, features, placement scope, duration, and any agreed extras. A displayed starting price is not a final custom quote.' || chr(10) ||
                    '6.4. Corporate payment is made through an M-Pesa STK push or another M-Pesa payment instruction shown by ITUKARUA KENYA. The account or placement is activated only after the payment is confirmed and any required verification is complete.' || chr(10) ||
                    '6.5. If verification fails, the organization cannot be reasonably confirmed, or the requested placement cannot be delivered, ITUKARUA KENYA may decline or suspend the corporate account and will refund an undelivered payment where required by law.' || chr(10) || chr(10) ||
                    '7. YOUR CONTENT'),
                  '7. PRIVACY AND DATA PROTECTION', '8. PRIVACY AND DATA PROTECTION'),
                '8. LIABILITY', '9. LIABILITY'),
              '9. INDEMNITY', '10. INDEMNITY'),
            '10. SUSPENSION AND TERMINATION', '11. SUSPENSION AND TERMINATION'),
          '11. DISPUTES AND GOVERNING LAW', '12. DISPUTES AND GOVERNING LAW'),
        '12. CHANGES', '13. CHANGES'),
      'Last updated: 30 October 2026 — version 2.0',
      'Last updated: 4 November 2026 — version 2.1'),
    'version 2.0',
    'version 2.1')
where key = 'terms'
  and content not like '%CORPORATE ACCOUNT VERIFICATION AND PAYMENT%';
