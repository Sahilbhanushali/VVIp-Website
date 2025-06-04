<?php
header('Content-Type: application/json');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Path to PHPMailer files
require 'assets/mailer/PHPMailer-master/src/Exception.php';
require 'assets/mailer/PHPMailer-master/src/PHPMailer.php';
require 'assets/mailer/PHPMailer-master/src/SMTP.php';

// Initialize response with more detailed structure
$response = [
    'success' => false,
    'message' => 'Something went wrong. Please try again later.',
    'errors' => [],
    'debug' => [] // For debugging purposes only
];

try {
    // Get and sanitize form data with more rigorous filtering
    $name = trim(filter_input(INPUT_POST, 'name', FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW));
    $email = trim(filter_input(INPUT_POST, 'email', FILTER_SANITIZE_EMAIL));
    $phone = trim(filter_input(INPUT_POST, 'phone', FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW));

    $subject = trim(filter_input(INPUT_POST, 'subject', FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW)) ?: 'Contact Form Submission';
    $message = trim(filter_input(INPUT_POST, 'message', FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW));

    // Store original values for debug
    $response['debug']['received_data'] = [
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'subject' => $subject,
        'message' => $message
    ];

    // Validate required fields with specific error messages
    $errors = [];
    if (empty($name)) {
        $errors['name'] = 'Please enter your name';
    } elseif (strlen($name) < 2) {
        $errors['name'] = 'Name must be at least 2 characters';
    }

    if (empty($email)) {
        $errors['email'] = 'Please enter your email address';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Please enter a valid email address';
    }
    if (empty($phone)) {
        $errors['phone'] = 'Please enter your phone number';
    } elseif (!preg_match('/^\+?[0-9\s\-]{7,15}$/', $phone)) {
        $errors['phone'] = 'Please enter a valid phone number';
    }
    

    if (empty($message)) {
        $errors['message'] = 'Please enter your message';
    } elseif (strlen($message) < 10) {
        $errors['message'] = 'Message must be at least 10 characters';
    }

    if (!empty($errors)) {
        $response['errors'] = $errors;
        $response['message'] = 'Please correct the errors below';
        echo json_encode($response);
        exit;
    }

    // Create PHPMailer instance
    $mail = new PHPMailer(true);

    // SMTP Configuration
    $mail->isSMTP();
    $mail->Host = 'mail.smtp2go.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'vapisvip'; // Your SMTP2Go username
    $mail->Password = 'Givemeredp0wer@123'; // Your SMTP2Go password
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;
    $mail->Timeout = 15;
    $mail->SMTPDebug = 0;
    
    // Important anti-spam settings
    $mail->Priority = 3; // Normal priority
    $mail->CharSet = 'UTF-8';
    $mail->Encoding = 'base64';
    $mail->XMailer = ' '; // Remove X-Mailer header

    // Sender and recipient configuration
    $mail->setFrom('mail@vapisvip.com', 'Vapisvip Website');
    $mail->addAddress('mail@vapisvip.com', 'Vapisvip Support');
    $mail->addReplyTo($email, $name);
    
    // Add important headers to prevent spam marking
    $mail->addCustomHeader('List-Unsubscribe', '<mailto:unsubscribe@vapisvip.com>, <https://vapisvip.com/unsubscribe>');
    $mail->addCustomHeader('Precedence', 'bulk');
    $mail->addCustomHeader('X-Auto-Response-Suppress', 'All');
    $mail->addCustomHeader('X-Originating-IP', $_SERVER['REMOTE_ADDR']);
    $mail->addCustomHeader('MIME-Version', '1.0');
    $mail->MessageID = '<' . time() . '.' . md5($mail->From . $mail->addAddress) . '@vapisvip.com>';

    // Email content
    $mail->isHTML(true);
    $mail->Subject = "New Contact: " . htmlspecialchars($subject) . " - " . htmlspecialchars($name);
    
    // Improved HTML email template
    $mail->Body = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                h2 { color: #2c3e50; }
                hr { border: 0; height: 1px; background: #ddd; margin: 20px 0; }
                .footer { font-size: 0.8em; color: #777; }
                a { color: #3498db; }
            </style>
        </head>
        <body>
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>
            <p><strong>Email:</strong> <a href=\"mailto:" . htmlspecialchars($email) . "\">" . htmlspecialchars($email) . "</a></p>
            <p><strong>Subject:</strong> " . htmlspecialchars($subject) . "</p>
            <p><strong>Message:</strong></p>
            <p>" . nl2br(htmlspecialchars($message)) . "</p>
            <hr>
            <div class=\"footer\">
                <p>This message was sent from the contact form on " . date('F j, Y \a\t g:i a') . "</p>
                <p>© " . date('Y') . " Vapisvip. All rights reserved.</p>
                <p><small><a href=\"https://vapisvip.com/privacy\">Privacy Policy</a> | <a href=\"https://vapisvip.com/unsubscribe\">Unsubscribe</a></small></p>
            </div>
        </body>
        </html>
    ";

    // Plain text version
    $mail->AltBody = "NEW CONTACT FORM SUBMISSION\n\n" .
        "Name: " . $name . "\n" .
        "Email: " . $email . "\n" .
        "Subject: " . $subject . "\n\n" .
        "Message:\n" . str_repeat("-", 50) . "\n" .
        $message . "\n\n" .
        "Sent from website contact form on " . date('F j, Y \a\t g:i a') . "\n" .
        "© " . date('Y') . " Vapisvip. All rights reserved.\n" .
        "Privacy Policy: https://vapisvip.com/privacy\n" .
        "Unsubscribe: https://vapisvip.com/unsubscribe";

    if ($mail->send()) {
        $response['success'] = true;
        $response['message'] = 'Thank you! Your message has been sent successfully.';
    } else {
        throw new Exception('Mailer Error: ' . $mail->ErrorInfo);
    }

} catch (Exception $e) {
    $response['message'] = 'There was a problem sending your message. Please try again later.';
    $response['debug']['error'] = $e->getMessage();
    error_log('Mailer Error: ' . $e->getMessage());
    
    if (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false) {
        $response['debug']['full_error'] = $e->getTraceAsString();
    }
}

// Remove debug info in production
if (!in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1'])) {
    unset($response['debug']);
}

echo json_encode($response);