import * as nodemailer from 'nodemailer';

import { IEmailAdapter } from './IEmailAdapter';

export class NodemailerAdapter implements IEmailAdapter {
    async send(
        from: string,
        to: string[],
        subject: string,
        html: string
    ): Promise<boolean> {

        const testAccount = await nodemailer.createTestAccount();

        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        const info = await transporter.sendMail({
            from,
            to: to.join(', '),
            subject,
            text: html.replace(/<[^>]*>?/gm, ''),
            html
        });

        console.log(`Message sent: ${info.messageId}`);
        console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

        return true;
    }
}
