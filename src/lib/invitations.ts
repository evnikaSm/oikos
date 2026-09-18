const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validInviteToken(value: string): boolean {
    return tokenPattern.test(value);
}

/** Read a household link without ever navigating to user-provided destinations. */
export function parseInvitationLink(value: string, origin: string): string | null {
    try {
        const url = new URL(value.trim());
        const tokens = url.searchParams.getAll("invite");
        if (url.origin !== origin || url.pathname !== "/" || url.username || url.password || tokens.length !== 1) return null;
        return validInviteToken(tokens[0]) ? tokens[0].toLowerCase() : null;
    } catch { return null; }
}
