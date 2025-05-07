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
    // Validate CSRF token if you have one
    // if (empty($_POST['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'])) {
    //     throw new Exception('Invalid CSRF token');
    // }

    // Get and sanitize form data with more rigorous filtering
    $name = trim(filter_input(INPUT_POST, 'name', FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW));
    $email = trim(filter_input(INPUT_POST, 'email', FILTER_SANITIZE_EMAIL));
    $subject = trim(filter_input(INPUT_POST, 'subject', FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW)) ?: 'Contact Form Submission';
    $message = trim(filter_input(INPUT_POST, 'message', FILTER_SANITIZE_STRING, FILTER_FLAG_STRIP_LOW));

    // Store original values for debug
    $response['debug']['received_data'] = [
        'name' => $name,
        'email' => $email,
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

    // Create PHPMailer instance with more configuration options
    $mail = new PHPMailer(true);

    // SMTP2Go Configuration with timeout settings
    $mail->isSMTP();
    $mail->Host = 'mail.smtp2go.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'vapisvip'; // Your SMTP2Go username
    $mail->Password = 'Givemeredp0wer@123'; // Your SMTP2Go password
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;
    $mail->Timeout = 15; // 15 seconds timeout
    $mail->SMTPDebug = 0; // Set to 2 for debugging

    // Recipients with additional headers
    $mail->setFrom('mail@vapisvip.com', 'Website Contact Form');
    $mail->addAddress('neovistaconnect@gmail.com', 'Vapisvip');
    $mail->addReplyTo($email, $name);
    $mail->addCustomHeader('X-Mailer', 'PHPMailer');
    $mail->addCustomHeader('X-Originating-IP', $_SERVER['REMOTE_ADDR']);

    // Content with improved HTML structure
    $mail->isHTML(true);
    $mail->Subject = "New Contact: " . htmlspecialchars($subject) . " - " . htmlspecialchars($name);
    
    $mail->Body = "
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                h2 { color: #2c3e50; }
                hr { border: 0; height: 1px; background: #ddd; margin: 20px 0; }
                .footer { font-size: 0.8em; color: #777; }
            </style>
        </head>
        <body>
            <div class='container'>
                <h2>New Contact Form Submission</h2>
                <p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>
                <p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>
                <p><strong>Service Type:</strong> " . htmlspecialchars($subject) . "</p>
                <p><strong>Message:</strong></p>
                <p>" . nl2br(htmlspecialchars($message)) . "</p>
                <hr>
                <p class='footer'>This message was sent from the website contact form on " . date('Y-m-d H:i:s') . "</p>
            </div>
        </body>
        </html>
    ";

    // Plain text version with better formatting
    $mail->AltBody = "NEW CONTACT FORM SUBMISSION\n\n" .
        "Name: " . $name . "\n" .
        "Email: " . $email . "\n" .
        "Service Type: " . $subject . "\n\n" .
        "Message:\n" . str_repeat("-", 50) . "\n" .
        $message . "\n\n" .
        "Sent from website contact form on " . date('Y-m-d H:i:s');

    // Additional security headers
    $mail->addCustomHeader('MIME-Version', '1.0');
    $mail->addCustomHeader('Content-Transfer-Encoding', '8bit');
    $mail->addCustomHeader('X-Priority', '3');
    $mail->addCustomHeader('X-MSMail-Priority', 'Normal');

    if ($mail->send()) {
        $response['success'] = true;
        $response['message'] = 'Thank you! Your message has been sent successfully.';
        $response['debug']['mailer_info'] = 'Message sent successfully';
    } else {
        throw new Exception('Mailer Error: ' . $mail->ErrorInfo);
    }

} catch (Exception $e) {
    $response['message'] = 'There was a problem sending your message. Please try again later.';
    $response['debug']['error'] = $e->getMessage();
    
    // Log the error for admin review
    error_log('Mailer Error: ' . $e->getMessage());
    
    // For security, don't expose full error details in production
    if (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false) {
        $response['debug']['full_error'] = $e->getTraceAsString();
    }
}

// In production, you might want to remove debug info
if (!in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1'])) {
    unset($response['debug']);
}

echo json_encode($response);