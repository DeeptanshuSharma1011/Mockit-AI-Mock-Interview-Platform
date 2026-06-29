import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { isUsingMockDB, mockDB, supabase } from "../config/db";
import { AuthenticatedRequest } from "../middleware/auth";

const JWT_SECRET = process.env.JWT_SECRET || "mockit-jwt-secret-key-256";

export async function signup(req: Request, res: Response) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  const sanitizedEmail = email.toLowerCase().trim();

  try {
    let emailExists = false;

    if (isUsingMockDB) {
      emailExists = mockDB.users.some(u => u.email === sanitizedEmail);
    } else {
      const { data: existingUser, error } = await supabase
        .from("users")
        .select("email")
        .eq("email", sanitizedEmail)
        .maybeSingle();

      if (error) {
        throw new Error("Supabase lookup error: " + error.message);
      }
      emailExists = !!existingUser;
    }

    if (emailExists) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let createdUser: { id: string; name: string; email: string; analytics: any };

    const initialAnalytics = {
      overallScore: 0,
      technicalScore: 0,
      communicationScore: 0,
      confidenceScore: 0,
      domainWiseScores: {},
      totalInterviews: 0,
      improvementTrends: []
    };

    if (isUsingMockDB) {
      const mockUser = {
        id: "mock_usr_" + Math.random().toString(36).substr(2, 9),
        name,
        email: sanitizedEmail,
        passwordHash,
        analytics: initialAnalytics,
        createdAt: new Date()
      };
      mockDB.users.push(mockUser);
      createdUser = {
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        analytics: mockUser.analytics
      };
    } else {
      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          name,
          email: sanitizedEmail,
          password_hash: passwordHash,
          analytics: initialAnalytics
        })
        .select()
        .single();

      if (error || !newUser) {
        throw new Error("Supabase insert error: " + (error?.message || "Failed to create user record. Ensure 'users' table exists."));
      }

      createdUser = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        analytics: newUser.analytics
      };
    }

    const token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email, name: createdUser.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: createdUser
    });

  } catch (error: any) {
    console.error("Signup controller error:", error);
    res.status(500).json({ error: "Database error during registration: " + error.message });
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const sanitizedEmail = email.toLowerCase().trim();

  try {
    let foundUser: any = null;

    if (isUsingMockDB) {
      foundUser = mockDB.users.find(u => u.email === sanitizedEmail);
    } else {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", sanitizedEmail)
        .maybeSingle();

      if (error) {
        throw new Error("Supabase lookup error: " + error.message);
      }
      foundUser = data;
    }

    if (!foundUser) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Adapt database password property name if needed (support both passwordHash from mock/legacy or password_hash from table)
    const storedHash = foundUser.password_hash || foundUser.passwordHash;
    const isMatch = await bcrypt.compare(password, storedHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const userIdStr = foundUser.id;

    const token = jwt.sign(
      { userId: userIdStr, email: foundUser.email, name: foundUser.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: userIdStr,
        name: foundUser.name,
        email: foundUser.email,
        analytics: foundUser.analytics
      }
    });

  } catch (error: any) {
    console.error("Login controller error:", error);
    res.status(500).json({ error: "Database error during authentication: " + error.message });
  }
}

export async function getUserProfile(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthenticated request" });
  }

  try {
    let foundUser: any = null;

    if (isUsingMockDB) {
      foundUser = mockDB.users.find(u => u.id === req.user?.userId);
    } else {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", req.user.userId)
        .maybeSingle();

      if (error) {
        throw new Error("Supabase lookup error: " + error.message);
      }
      foundUser = data;
    }

    if (!foundUser) {
      return res.status(404).json({ error: "User profile not found" });
    }

    res.json({
      user: {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        analytics: foundUser.analytics
      }
    });

  } catch (error: any) {
    console.error("Get user profile controller error:", error);
    res.status(500).json({ error: "Failed to retrieve candidate profile: " + error.message });
  }
}
