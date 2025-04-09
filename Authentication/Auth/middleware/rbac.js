export const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};

export const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get user's role and check permissions
        const userRole = req.user.role;
        const hasPermission = checkRolePermission(userRole, permission);

        if (!hasPermission) {
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        }

        next();
    };
};

// Helper function to check role permissions
const checkRolePermission = (role, permission) => {
    const rolePermissions = {
        admin: ['read', 'write', 'delete', 'manage_users', 'manage_roles'],
        user: ['read', 'write'],
        guest: ['read']
    };

    return rolePermissions[role]?.includes(permission) || false;
}; 