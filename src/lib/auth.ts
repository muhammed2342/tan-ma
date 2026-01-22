import jwt from "jsonwebtoken";

type AuthTokenPayload = {
    userId: string;
};

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("JWT_SECRET is not set");
        }
        return "dev_secret_change_me";
    }
    return secret;
}

export function signAuthToken(userId: string) {
    const secret = getJwtSecret();
    return jwt.sign({ userId } satisfies AuthTokenPayload, secret, {
        expiresIn: "30d",
    });
}

export function verifyAuthToken(token: string) {
    const secret = getJwtSecret();
    try {
        return jwt.verify(token, secret) as AuthTokenPayload;
    } catch {
        return null;
    }
}
